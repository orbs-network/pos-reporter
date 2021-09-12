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

import { getGuardiansPeriodsReport, getPeriodsReport } from './report.js';
import { reportToXlsx } from './xls.js';

async function getReport(reportPeriodLength, reportNumberOfPeriods, reportShowOnlyFull) {
    const ethereumEndpoint = 'https://mainnet.infura.io/v3/e0abafac3c8d46c3a9befb6e8b14abc9';
    const nodeEndpoints = ['https://0xcore-management-direct.global.ssl.fastly.net/status'];

    const options = {
      period_in_blocks: new Number(reportPeriodLength).valueOf(), 
      periods: new Number(reportNumberOfPeriods).valueOf(), 
      show_only_full_periods: reportShowOnlyFull === 'true'
    };

    //const report = await getGuardiansPeriodsReport(guardianAddresses, includeDelegators, ethereumEndpoint, options);
    const report = await getPeriodsReport(ethereumEndpoint, nodeEndpoints, options)
    return reportToXlsx(report);
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
    value: '604800'
  },
  {
    key: 'Monthly',
    text: 'Monthly (30 days)',
    value: '199385'
  },
  {
    key: 'Weekly',
    text: 'Weekly (7 days)',
    value: '46525'
  }
];

function App() {
  const [input, setInput] = useState({reportType: '604800', reportPeriods: '3', reportShowFull: 'false', reportFilenamePrefix: "report"});
  const [loading, setLoading] = useState(false);
  const handleChange = (_e, { name, value }) => setInput({ ...input, [name]: value });
  const handleSubmit = async () => {
    const { reportType, reportPeriods, reportShowFull, reportFilenamePrefix } = input;
    setLoading(true);
    const result = await getReport(reportType, reportPeriods, reportShowFull);
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
              label="Report Type"
              name="reportType"
              options={periodOptions}
              defaultValue="604800"
              onChange={handleChange}
            />
            <Form.Input
              label="Number Of Report Periods"
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
