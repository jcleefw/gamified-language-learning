// Generated from: e2e/features/sentence-question.feature
import { test } from "playwright-bdd";

test.describe('Sentence question word-block', () => {

  test.beforeEach('Background', async ({ Given, And, page }, testInfo) => { if (testInfo.error) return;
    await Given('the app is open with a clean session', null, { page }); 
    await And('the shelving config is reset to defaults', null, { page }); 
  });
  
  test('Sentence questions appear in batch when words are pre-seeded as seen', async ({ Given, When, Then, page }) => { 
    await Given('the scenario "minimal-sentence-ready" is loaded', null, { page }); 
    await When('I select the "let\'s eat something" deck', null, { page }); 
    await Then('I should see a sentence question in the batch', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/features/sentence-question.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":11,"pickleLine":7,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","isBg":true,"stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Context","textWithKeyword":"And the shelving config is reset to defaults","isBg":true,"stepMatchArguments":[]},{"pwStepLine":12,"gherkinStepLine":8,"keywordType":"Context","textWithKeyword":"Given the scenario \"minimal-sentence-ready\" is loaded","stepMatchArguments":[{"group":{"start":13,"value":"\"minimal-sentence-ready\"","children":[{"start":14,"value":"minimal-sentence-ready","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":13,"gherkinStepLine":9,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":14,"gherkinStepLine":10,"keywordType":"Outcome","textWithKeyword":"Then I should see a sentence question in the batch","stepMatchArguments":[]}]},
]; // bdd-data-end