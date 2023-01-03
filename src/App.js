/**
 * Copyright 2021 the pos-reporter authors
 * This file is part of the pos-reporter in the Orbs project.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root directory of this source tree.
 * The above notice should be included in all copies or substantial portions of the software.
 */

import React, { useState } from "react";
import { Container, Segment, Form } from "semantic-ui-react";
import "./App.css";

import { getPeriodsReport, generatePeriodsStart, getWeb3 } from './report.js';
import { reportToXlsx } from './xls.js';
const providersEndpoints = {
  'ethereum': 'https://mainnet.infura.io/v3/e0abafac3c8d46c3a9befb6e8b14abc9',
  'polygon': 'https://polygon-mainnet.g.alchemy.com/v2/c93z5UqYd5bR2paVR7PtUXhkVEIDIex0'
}
const providersNodesEndpoints = {
  'ethereum': ['https://0xcore-management-direct.global.ssl.fastly.net/status'],
  'polygon': ['https://0xcore-matic-reader-direct.global.ssl.fastly.net/status']
}
const PeriodInBlocks = {
  'Quarterly': {'ethereum': '604800', 'polygon': '3435449'},
  'Monthly': {'ethereum': '199385', 'polygon': '1132565'},
  'Weekly': {'ethereum': '46525', 'polygon': '264265'}
}
async function getReport(reportPeriodLength, networkType, reportNumberOfPeriods, reportShowOnlyFull) {
  const ethereumEndpoint = providersEndpoints[networkType];
  const nodeEndpoints = providersNodesEndpoints[networkType];
  const ethNodeEndpoints = providersNodesEndpoints['ethereum'];

  const web3Eth = await getWeb3(providersEndpoints['ethereum']);
  let periodsStartEth;
  let options;

  if (reportPeriodLength === "Custom") {
    // 1 period. Start = reportNumberOfPeriods ("From block")
    let blockNumber;
    if (networkType === 'polygon') {
      const web3 = await getWeb3(providersEndpoints['polygon']);
      blockNumber = (await web3.eth.getBlock("latest")).number;
    } else {
      blockNumber = (await web3Eth.eth.getBlock("latest")).number;
    }
    const period_in_blocks = blockNumber - parseInt(reportNumberOfPeriods);
    options = {
      period_in_blocks: period_in_blocks,
      periods: 1,
      show_only_full_periods: reportShowOnlyFull === 'true'
    };

    const block = await web3Eth.eth.getBlock(reportNumberOfPeriods);
    periodsStartEth = [{number: block.number, time: block.timestamp}];
  }
  else {
    options = {
      period_in_blocks: new Number(PeriodInBlocks[reportPeriodLength]['ethereum']).valueOf(),
      periods: new Number(reportNumberOfPeriods).valueOf(),
      show_only_full_periods: reportShowOnlyFull === 'true'
    };
    periodsStartEth = await generatePeriodsStart(options, web3Eth)
    options.period_in_blocks = new Number(PeriodInBlocks[reportPeriodLength][networkType]).valueOf()
  }
  return await getPeriodsReport(ethereumEndpoint, networkType, nodeEndpoints, ethNodeEndpoints, options, periodsStartEth)
}

function joinReports(report1, report2) {
  let result = {
    details: report1.details,
    participants: []
  }

  const participants = report1.participants.concat(report2.participants);

  for (let i=0; i<participants.length-1; i++) {
    let foundMatch = false;
    for (let j=i+1; j<participants.length; j++) {
      if ((participants[i].guardianAddress === participants[j].guardianAddress && participants[i].type === participants[j].type)
          && (!['Delegator', 'Historical Delegator'].includes(participants[i].type) || (participants[i].delegatorAddress === participants[j].delegatorAddress))) {
        // condition to match and sum up the rewards: same guardian and type. if type in ['Delegator', 'Historical Delegator'] then only sum the same delegator, otherwise add to result set
        foundMatch = true;
        let p = participants[i];
        p.rewards = participants[i].rewards.map(function (num, idx) {
          return num + participants[j].rewards[idx];
        });
        result.participants.push(p);
        participants.splice(j, 1); // remove to prevent duplicates
        break;
      }
    }
    if (!foundMatch) result.participants.push(participants[i]);
  }

  return result;
}

function downloadReport(report, reportFilenamePrefix) {
  const url = window.URL.createObjectURL(new Blob([report]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${reportFilenamePrefix}.${new Date().toISOString()}.xlsx`);
  link.setAttribute('type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
}

const periodOptions = [
  {
    key: 'Quarterly',
    text: 'Quarterly (91 days)',
    value: 'Quarterly'
  },
  {
    key: 'Monthly',
    text: 'Monthly (30 days)',
    value: 'Monthly'
  },
  {
    key: 'Weekly',
    text: 'Weekly (7 days)',
    value: 'Weekly'
  },
  {
    key: 'Custom',
    text: 'Custom (From block #)',
    value: 'Custom'
  }
];

const networkOptions =[
  {
    key: 'All',
    text: 'All',
    value: 'all'
  },
  {
    key: 'Ethereum',
    text: 'Ethereum',
    value: 'ethereum'
  },
  {
    key: 'Polygon',
    text: 'Polygon',
    value: 'polygon'
  }
];

function App() {
  const [input, setInput] = useState({reportType: 'Quarterly', networkType: 'all', reportPeriods: '3', reportShowFull: 'false', reportFilenamePrefix: "report"});
  const [loading, setLoading] = useState(false);
  const handleChange = (_e, { name, value }) => setInput({ ...input, [name]: value });
  const { reportType, networkType, reportPeriods, reportShowFull, reportFilenamePrefix } = input;
  const handleSubmit = async () => {
    setLoading(true);
    let report = null;
    if (networkType === 'all') {
      const ethResult = await getReport(reportType, 'ethereum', reportPeriods, reportShowFull);
      const polyResult = await getReport(reportType, 'polygon', reportPeriods, reportShowFull);
      report = joinReports(ethResult, polyResult)
    }
    else {
      report = await getReport(reportType, networkType, reportPeriods, reportShowFull);
    }

    // sort the results
    const typesOrder = ['Total', 'Self-Share (guardian + self-delegate)', 'Total Delegators', 'Delegator', 'Historical Delegator'];
    report.participants.sort((a, b) => {
      if (a.guardianAddress === b.guardianAddress) return typesOrder.indexOf(a.type) - typesOrder.indexOf(b.type);
      return a.guardianAddress > b.guardianAddress ? 1 : -1;
    });

    const result = await reportToXlsx(report)
    downloadReport(result, reportFilenamePrefix);
    setLoading(false);
  };

  return (
      <div className="App">
        <h2>Orbs Rewards Report Generator</h2>
        <br />
        <Container textAlign="left">
          <Segment textAlign="left" secondary style={{ width: "50vw", margin: "auto" }}>
            <Form loading={loading} onSubmit={handleSubmit} spellcheck="false">
              <Form.Select
                  label="Network"
                  name="networkType"
                  options={networkOptions}
                  defaultValue="all"
                  onChange={handleChange}
              />
              <Form.Select
                  label="Report Type"
                  name="reportType"
                  options={periodOptions}
                  defaultValue="Quarterly"
                  onChange={handleChange}
              />
              <Form.Input
                  label={reportType === 'Custom' ? 'From Block' : "Number Of Report Periods"}
                  name="reportPeriods"
                  defaultValue="3"
                  onChange={handleChange}
              />
              <Form.Checkbox
                  radio
                  label="Show Only Full Periods"
                  name="reportShowFull"
                  value="true"
                  checked={input.reportShowFull === 'true'}
                  onChange={handleChange}
              />
              <Form.Checkbox
                  radio
                  label="Show Last Partial Period"
                  name="reportShowFull"
                  value="false"
                  checked={input.reportShowFull === 'false'}
                  onChange={handleChange}
              />
              <Form.Input
                  label="File Name Prefix"
                  name="reportFilenamePrefix"
                  defaultValue="report"
                  onChange={handleChange}
              />
              <Form.Button primary>Submit</Form.Button>
            </Form>
          </Segment>
        </Container>
      </div>
  );
}

export default App;
