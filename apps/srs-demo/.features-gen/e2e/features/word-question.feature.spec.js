// Generated from: e2e/features/word-question.feature
import { test } from "playwright-bdd";

test.describe('Word question (MCQ)', () => {

  test.beforeEach('Background', async ({ Given, page }, testInfo) => { if (testInfo.error) return;
    await Given('the app is open with a clean session', null, { page }); 
  });
  
  test('A word question displays a prompt and four choices', async ({ When, Then, page }) => { 
    await When('I select the "let\'s eat something" deck', null, { page }); 
    await Then('I should see a word question with 4 choices', null, { page }); 
  });

  test('Answering correctly advances to the next question', async ({ When, Then, And, page }) => { 
    await When('I select the "let\'s eat something" deck', null, { page }); 
    await And('I note the word question prompt', null, { page }); 
    await And('I answer the word question correctly', null, { page }); 
    await Then('I should see a different question or the batch results screen', null, { page }); 
  });

  test('A wrong word answer is re-presented later in the same batch', async ({ When, Then, And, page }) => { 
    await When('I select the "let\'s eat something" deck', null, { page }); 
    await And('I note the word value from the cheat hint', null, { page }); 
    await And('I answer the word question incorrectly', null, { page }); 
    await Then('the same word should appear again before the batch ends', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/features/word-question.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":10,"pickleLine":6,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","isBg":true,"stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":7,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":12,"gherkinStepLine":8,"keywordType":"Outcome","textWithKeyword":"Then I should see a word question with 4 choices","stepMatchArguments":[]}]},
  {"pwTestLine":15,"pickleLine":10,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","isBg":true,"stepMatchArguments":[]},{"pwStepLine":16,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":17,"gherkinStepLine":12,"keywordType":"Action","textWithKeyword":"And I note the word question prompt","stepMatchArguments":[]},{"pwStepLine":18,"gherkinStepLine":13,"keywordType":"Action","textWithKeyword":"And I answer the word question correctly","stepMatchArguments":[]},{"pwStepLine":19,"gherkinStepLine":14,"keywordType":"Outcome","textWithKeyword":"Then I should see a different question or the batch results screen","stepMatchArguments":[]}]},
  {"pwTestLine":22,"pickleLine":16,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","isBg":true,"stepMatchArguments":[]},{"pwStepLine":23,"gherkinStepLine":17,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":24,"gherkinStepLine":18,"keywordType":"Action","textWithKeyword":"And I note the word value from the cheat hint","stepMatchArguments":[]},{"pwStepLine":25,"gherkinStepLine":19,"keywordType":"Action","textWithKeyword":"And I answer the word question incorrectly","stepMatchArguments":[]},{"pwStepLine":26,"gherkinStepLine":20,"keywordType":"Outcome","textWithKeyword":"Then the same word should appear again before the batch ends","stepMatchArguments":[]}]},
]; // bdd-data-end