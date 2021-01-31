/**
 * Copyright 2021 the pos-reporter authors
 * This file is part of the pos-reporter in the Orbs project.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root directory of this source tree.
 * The above notice should be included in all copies or substantial portions of the software.
 */

import XLSX from 'xlsx';

const fileExtension = 'xlsx';

export function reportToXlsx(report, outputType) {
    let workbook = XLSX.utils.book_new();

    const s1data = [];
    const cols = [{wch:42}, {wch:35},{wch:5}, {wch:35}, {wch:42}];

    const header1 = ['','','','',''], header2 = ['','','','',''], header3 = ['','','','',''], header4 = ['Guardian Address','Guardian Name', 'Certified', 'Type', 'Delegaor Address'];
    for(let i = 0;i < report.details.number_of_periods;i++) {
        header1.push(`Period ${i+1}`);
        header2.push(`${toDate(report.details.periods[i].start_block_time)} to ${toDate(report.details.periods[i].end_block_time)} GMT`);
        header3.push(`${report.details.periods[i].start_block} to ${report.details.periods[i].end_block} (${report.details.periods[i].length} blocks)`)
        header4.push('Distributed (ORBS)')
        cols.push({wch:40});
    }
    s1data.push(header1, header2, header3, header4);


    for (const participant of report.participants) {
        const row = [
            participant.guardianAddress, participant.guardianName, participant.guardianCertified, 
            participant.type, participant.delegatorAddress || '', ...participant.rewards 
        ];
        if (participant.rewards.length === 0) {
            row.push('Missing Data');
        }
        s1data.push(row);
    }
   
    const worksheet = XLSX.utils.aoa_to_sheet(s1data);
    // formatting
    worksheet['!cols'] = cols;
    const range = { s: {r:4, c:5}, e: {r:4+report.participants.length-1, c:5+(report.details.number_of_periods)-1} };
    for(let R = range.s.r; R <= range.e.r; ++R) {
        for(let C = range.s.c; C <= range.e.c; ++C) {
            const cell = worksheet[XLSX.utils.encode_cell({r:R,c:C})];
            if (cell) {
            cell.z = "#,##0.00";
            cell.t = 'n';
            } else {
                console.log(XLSX.utils.encode_cell({r:R,c:C}))
            }
        }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

    return XLSX.write(workbook, { bookType: fileExtension, type: outputType });
}

function toDate(seconds) {
    const d = new Date(seconds * 1000).toISOString();
    return d.slice(0,10) + ' ' + d.slice(11,19);
}
