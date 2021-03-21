/**
 * Copyright 2021 the pos-reporter authors
 * This file is part of the pos-reporter library in the Orbs project.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root directory of this source tree.
 * The above notice should be included in all copies or substantial portions of the software.
 */

import {Workbook} from 'exceljs';

export async function reportToXlsx(report) {
    const workbook = new Workbook();  
    const worksheet = workbook.addWorksheet('Report', {views:[{state: 'frozen', ySplit: 3}]});  
    
    // headers
    const header2 = ['','','','',''], header3 = ['','','','',''], header4 = ['Guardian Address','Guardian Name', 'Certified', 'Type', 'Delegaor Address'];
    const totals = [];
    for(let i = report.details.number_of_periods-1;i >= 0;i--) {
        header2.push(`${toDate(report.details.periods[i].start_block_time)} to ${toDate(report.details.periods[i].end_block_time)} GMT`);
        header3.push(`${report.details.periods[i].start_block} to ${report.details.periods[i].end_block} (${report.details.periods[i].length} blocks)`)
        header4.push('Distributed (ORBS)');
        totals.push(0);
    }
    worksheet.addRows([header2, header3, header4]);

    // data
    for (const participant of report.participants) {
        const row = [
            participant.guardianAddress, participant.guardianName, participant.guardianCertified, 
            participant.type, participant.delegatorAddress || ''
        ];
        if (participant.rewards.length === 0) {
            row.push('Missing Data');
        } else { 
            for(let i = participant.rewards.length;i < report.details.number_of_periods;i++) {
                row.push(0);
            }
            for (let i = participant.rewards.length-1;i >=0;i--) {
                row.push(participant.rewards[i]);
                if (participant.type === 'Total') { // notice the reverse order :)
                    totals[report.details.number_of_periods-1-i] = totals[report.details.number_of_periods-1-i] + participant.rewards[i];
                }
            }
        }
        worksheet.addRow(row);
    }
    //worksheet.getCell('A3').value = { formula: 'A1+A2', result: 7 };
    const totalsRow = worksheet.addRow(['','','','','Total Distributed:', ...totals]);
    
    // formatting
    worksheet.getColumn(1).width = 42;
    worksheet.getColumn(2).width = 35;
    worksheet.getColumn(3).width = 8;
    worksheet.getColumn(4).width = 35;
    worksheet.getColumn(5).width = 42;
    for(let i = 0;i < report.details.number_of_periods;i++) {
        worksheet.getColumn(6+i).width = 40;  
    }
    worksheet.getRow(3).font = {bold: true};
    for(let j=4;j < 4+report.participants.length;j++) {
        const row = worksheet.getRow(j);
        if (row.getCell(4).value === 'Total') {
            row.font = {bold: true};
            row.border = {top: {style:'thin'}};
            row.getCell(5).border = {top: {style:'thin'}, right: {style:'thin'}};
        } else {
            row.getCell(5).border = {right: {style:'thin'}};
        }
        for(let i = 6;i < 6 + report.details.number_of_periods;i++) {
            row.getCell(i).numFmt = "#,##0.00";
        }

    }
    totalsRow.font = {bold: true};
    totalsRow.getCell(1).border = {top: {style:'thin'}};
    totalsRow.getCell(2).border = {top: {style:'thin'}};
    totalsRow.getCell(3).border = {top: {style:'thin'}};
    totalsRow.getCell(4).border = {top: {style:'thin'}};
    totalsRow.getCell(5).border = {top: {style:'thin'}, right: {style:'thin'}};
    for(let i = 6;i < 6 + report.details.number_of_periods;i++) {
         totalsRow.getCell(i).numFmt = "#,##0.00";
         totalsRow.getCell(i).border = {top: {style:'double'}};
    }
    
    return workbook.xlsx.writeBuffer()
}

function toDate(seconds) {
    const d = new Date(seconds * 1000).toISOString();
    return d.slice(0,10) + ' ' + d.slice(11,19);
}
