/**
 * Copyright 2021 the pos-reporter authors
 * This file is part of the pos-reporter in the Orbs project.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root directory of this source tree.
 * The above notice should be included in all copies or substantial portions of the software.
 */

import _  from 'lodash';
import { getDelegatorStakingRewards, getGuardian, getGuardians, getStartOfRewardsBlock, getWeb3, getWeb3Polygon } from "@orbs-network/pos-analytics-lib";

const DefaultPeriodBlocks = 604800;
const DefualtPeriods = 3;
const blockDuration = {1: 13, 137: 2}
const DefaultAbsoluteStartBlock = getStartOfRewardsBlock();
const DefaultExcluded = ['0x4aca0c63e351b2ea44ee628425710e933b5b3396', '0xca0ff0479bd7f52e55e65da7b76074b477b734b3'];
const web3Mapping = {'ethereum': getWeb3, 'polygon': getWeb3Polygon}
export {getWeb3};

async function getBlockByTimestamp(timestamp, chainId) {
    const apiUrl = chainId === 137 ? `https://api.polygonscan.com/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=before&apikey=BEVY6JKW1VTU634UWBE2FZYKN3EDB3RZSR` :
        `https://api.etherscan.io/api?module=block&action=getblocknobytime&closest=before&timestamp=${timestamp}&apikey=3U9E3HF8WYHXHCHNPP8E3AP8V7H2V8XU4T`
    const response = await fetch(apiUrl);
    const json = await response.json();
    if (json.status !== '1') {
        alert("An error occurred. Please try again")
    }
    return parseInt(json.result);
}

export async function getPeriodsReport(ethereumEndpoint, networkType, nodeEndpoints, ethNodeEndpoints, options, periods_start) {
    const interestingGuardians = [];
    const calculateDelegators = [];
    const excluded = options.exclude_guardians || DefaultExcluded;
    _.forEach(await getGuardians(nodeEndpoints, ethNodeEndpoints), g => {
        if (!excluded.includes(g.address)) {
            interestingGuardians.push(g.address);
            calculateDelegators.push(!g.certified);
        }
    });

    return getGuardiansPeriodsReport(interestingGuardians, networkType, calculateDelegators, ethereumEndpoint, options, periods_start);
}

export async function getGuardiansPeriodsReport(guardianAddresses, networkType, calculateDelegators, ethereumEndpoint, options, periods_start) {
    const web3 = _.isString(ethereumEndpoint) ? await web3Mapping[networkType](ethereumEndpoint) : ethereumEndpoint;

    const reportDetails = await generatePeriodDetails(options, web3, periods_start);
    const participants = [];

    for (let i = 0;i < guardianAddresses.length;i++) {
        try {
             participants.push(...(await getGuardianPeriodsReport(guardianAddresses[i], calculateDelegators[i], web3, reportDetails)));
        } catch (e) {
            participants.push({guardianAddress: guardianAddresses[i], rewards: []});
            console.log(`Error while generating guardian ${guardianAddresses[i]}: ${e} ... (skipped)`);
        }
    }

    trimNonFullPeriodIfNeeded(reportDetails, participants, options);
    
    return {
        details: reportDetails,
        participants
    }
}

export async function generatePeriodsStart(options, web3) {
    const maxEndBlock = await web3.eth.getBlock('latest');
    const periodsStart = [];
    const periodLength = options.period_in_blocks || DefaultPeriodBlocks;
    const maxPeriods = (options.periods || DefualtPeriods) + (options.show_only_full_periods === true ? 1 : 0);

    let currEnd = maxEndBlock.number;
    let currStart = (maxEndBlock.number - periodLength + 1) > DefaultAbsoluteStartBlock.number
        ? maxEndBlock.number - ((maxEndBlock.number - DefaultAbsoluteStartBlock.number) % periodLength)
        : DefaultAbsoluteStartBlock.number;
    do {
        const block_info = await web3.eth.getBlock(currStart);
        const block_ts = block_info.timestamp;
        periodsStart.push({'number': currStart, 'time': block_ts});
        currEnd = currStart - 1;
        currStart = currEnd - periodLength + 1;
    } while (periodsStart.length < maxPeriods && currStart >= DefaultAbsoluteStartBlock.number)
    return periodsStart;
}


// Generate full periods + partial (data always starts from )
async function generatePeriodDetails(options, web3, periods_start) {
    const maxEndBlock = await web3.eth.getBlock('latest');
    const periods = []; 
    const periodLength = options.period_in_blocks || DefaultPeriodBlocks;
    const chainId = await web3.eth.getChainId();

    const txs = [];
    let currEnd = maxEndBlock.number;
    let totalLength = 0;

    for (let start of periods_start) {
        let currStart = chainId === 137 ? await getBlockByTimestamp(start.time, chainId) : start.number;
        periods.push({
            start_block: currStart,
            start_block_time: 0,
            end_block: currEnd,
            end_block_time: 0,
            length: currEnd-currStart+1
        });
        totalLength += (currEnd-currStart+1);
        txs.push(web3.eth.getBlock(currStart));
        currEnd = currStart - 1;
        currStart = currEnd - periodLength + 1;
    }

    const res = await Promise.all(txs);
    for(let i = 0;i < periods.length;i++) {
        periods[i].end_block_time = Number(i === 0 ? maxEndBlock.timestamp : res[i-1].timestamp - blockDuration[chainId]);
        periods[i].start_block_time = Number(res[i].timestamp);
    }
 
    return {
        number_of_periods: periods.length,
        total_length_of_periods: totalLength,
        start_of_periods_block: periods[periods.length-1].start_block,
        end_of_periods_block: periods[0].end_block, 
        periods,
    }
}

async function getGuardianPeriodsReport(address, calculateDelegators, web3, report) {
    const readOptions = {
        read_from_block: report.start_of_periods_block - 10000, /* need cushion for event to have before first block */
    }
    const participantsRewards = [];

    let gInfo;
    try {
        gInfo = await getGuardian(address, web3, readOptions);
    } catch (e) {
        console.log(`Error while generating guardian ${address}: ${e.stack} ... (going to retry now)`);
        sleep(1000); // just in case
        gInfo = await getGuardian(address, web3, readOptions);
    }
    gInfo.details.certified = !calculateDelegators; // set the certified info calculated based on eth network
    const res = generateGuardianPeriodResults(gInfo, report.periods);
    participantsRewards.push(generateParticipantObject(gInfo, 'Total', res.allGuardianRewards));
    participantsRewards.push(generateParticipantObject(gInfo, 'Self-Share (guardian + self-delegate)', res.guardianSelfRewards));
    participantsRewards.push(generateParticipantObject(gInfo, 'Total Delegators', res.sumDelegatorRewards));

    if (calculateDelegators) {
        await generateAllDelegatorPaticipationRewads(gInfo, web3, readOptions, report.periods, participantsRewards);
    }

    return participantsRewards;
}

function generateGuardianPeriodResults(guardian, periods) {
    const guardianShareToTotal = 1.0 / (1.0-guardian.reward_status.delegator_reward_share);
    const guardianShareToAllDelegatorsShare = guardian.reward_status.delegator_reward_share / (1-guardian.reward_status.delegator_reward_share);

    const periodRewardsAsGuardian = generatePeriodReport(guardian.reward_as_guardian_slices, guardian.address, periods);
    const periodRewardsAsDelegator = generatePeriodReport(guardian.reward_as_delegator_slices, guardian.address, periods);
    const guardianSelfRewards = [], sumDelegatorRewards = [];
    for(let i = 0;i < periodRewardsAsGuardian.length;i++) {
        const periodDelegatorReward = i < periodRewardsAsDelegator.length ? periodRewardsAsDelegator[i] : 0
        guardianSelfRewards.push(periodRewardsAsGuardian[i] + periodDelegatorReward);
        sumDelegatorRewards.push(periodRewardsAsGuardian[i] * guardianShareToAllDelegatorsShare - periodDelegatorReward);
    }

    return { 
        allGuardianRewards: _.map(periodRewardsAsGuardian, v => v * guardianShareToTotal),
        sumDelegatorRewards, 
        guardianSelfRewards
    };
}

// Assumptions:
// 1. eigher the last reward is begining of time or there are more than needed.
// 2. for delegators an assignreward event happends when change of delegation.
function generatePeriodReport(rewards, guaridan, periodsData) {
    const periodRewards = [];
    let currPeriod = 0;
    let currPeriodReward = 0;
    for (let i = 0;currPeriod < periodsData.length && i < rewards.length-1;i++) {
        if (_.isUndefined(rewards[i].guardian_from) || rewards[i].guardian_from === guaridan) { // count this delta
            if (rewards[i+1].block_number >= periodsData[currPeriod].start_block) { // full 'delta' counted
                currPeriodReward += rewards[i].total_awarded - rewards[i+1].total_awarded;
            } else { // partial 'delta' counted 
                const deltaReward = rewards[i].total_awarded - rewards[i+1].total_awarded;
                const deltaBlocks = rewards[i].block_number - rewards[i+1].block_number;
                const neededDeltaBlocks = rewards[i].block_number - periodsData[currPeriod].start_block + 1;
                const neededDelta = deltaReward * neededDeltaBlocks / deltaBlocks
                currPeriodReward += neededDelta;
                periodRewards.push(currPeriodReward);
   
                currPeriodReward = deltaReward - neededDelta;
                currPeriod++;            
            }
        } else if (rewards[i+1].block_number <= periodsData[currPeriod].start_block) { // just check if next period
            periodRewards.push(currPeriodReward);
            currPeriodReward = 0;
            currPeriod++;            
        } 
    }
    if (currPeriod < periodsData.length) {
        periodRewards.push(currPeriodReward);
    }

    for (let i=periodRewards.length; i<periodsData.length; i++) {  // patch: fill missing periods with 0s
        periodRewards.push(0);
    }

    return periodRewards;
}

async function generateAllDelegatorPaticipationRewads(guardian, web3, options, periods, participantsRewards) {
    await generateTypedDelegatorPaticipationRewads(guardian, guardian.delegators, false, web3, options, periods, participantsRewards);
    await generateTypedDelegatorPaticipationRewads(guardian, guardian.delegators_left, true, web3, options, periods, participantsRewards);
}

async function generateTypedDelegatorPaticipationRewads(guardian, delegators, isHistoric, web3, options, periods, participantsRewards) {
    for (const delegator of delegators) {
        let drewards = []
        try {
            drewards = generatePeriodReport(await readRetryDelegator(delegator.address, web3, options), guardian.address, periods);
        } catch (e) {
            console.log(`Error while generating ${isHistoric ? "historical" : "" } delegator ${delegator.address}: ${e.stack} ... (skipped)`);
        }
        participantsRewards.push(generateParticipantObject(guardian, isHistoric ? 'Historical Delegator': 'Delegator', drewards, delegator.address));
    }
}

async function readRetryDelegator(address, web3, options) {
    try {
        return (await getDelegatorStakingRewards(address, web3, options)).rewards;
    } catch (e) {
        console.log(`Error while generating delegator ${address}: ${e.stack} ... (going to retry now)`);
        sleep(1000); // just in case
        return (await getDelegatorStakingRewards(address, web3, options)).rewards;
    }
}

function generateParticipantObject(guardian, type, rewards, delegatorAddress) {
    return {
        guardianAddress: guardian.address,
        guardianName: guardian.details.name,
        guardianCertified: guardian.details.certified,
        type,
        delegatorAddress,
        rewards
    };
}

function trimNonFullPeriodIfNeeded(details, participants, options) {
    const periodLength = options.period_in_blocks || DefaultPeriodBlocks;
    if (details.periods.length > 1 && details.periods[0].length < periodLength && options.show_only_full_periods === true) {
        details.total_length_of_periods = details.total_length_of_periods - details.periods[0].length;
        details.periods.shift();
        details.number_of_periods = details.number_of_periods - 1;
        details.end_of_periods_block = details.periods[0].end_block;
        for (const participant of participants) {
            participant.rewards.shift();
        }
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
