// Generated from: e2e/features/session-mastery.feature
import { test } from "playwright-bdd";

test.describe('SRS session mastery progression', () => {

  test.beforeEach('Background', async ({ Given, page }, testInfo) => { if (testInfo.error) return;
    await Given('the app is open with a clean session', null, { page }); 
  });
  
  test('Re-entering a deck after mastering words shows new words', async ({ When, Then, And, page }) => { 
    await When('I select the "let\'s eat something" deck', null, { page }); 
    await And('I answer all questions in the batch correctly', null, { page }); 
    await And('I click "Next Batch →"', null, { page }); 
    await And('I answer all questions in the batch correctly', null, { page }); 
    await And('I click "Next Batch →"', null, { page }); 
    await And('I answer all questions in the batch correctly', null, { page }); 
    await Then('I should see mastered words in the results', null, { page }); 
    await When('I click "Back to decks"', null, { page }); 
    await And('I reload the app', null, { page }); 
    await Then('I should see a saved session banner', null, { page }); 
    await When('I select the "let\'s eat something" deck again', null, { page }); 
    await Then('none of the mastered words should appear in the quiz active pool', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/features/session-mastery.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":10,"pickleLine":6,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","isBg":true,"stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":7,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":12,"gherkinStepLine":8,"keywordType":"Action","textWithKeyword":"And I answer all questions in the batch correctly","stepMatchArguments":[]},{"pwStepLine":13,"gherkinStepLine":9,"keywordType":"Action","textWithKeyword":"And I click \"Next Batch →\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Next Batch →\"","children":[{"start":9,"value":"Next Batch →","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":14,"gherkinStepLine":10,"keywordType":"Action","textWithKeyword":"And I answer all questions in the batch correctly","stepMatchArguments":[]},{"pwStepLine":15,"gherkinStepLine":11,"keywordType":"Action","textWithKeyword":"And I click \"Next Batch →\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Next Batch →\"","children":[{"start":9,"value":"Next Batch →","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":16,"gherkinStepLine":12,"keywordType":"Action","textWithKeyword":"And I answer all questions in the batch correctly","stepMatchArguments":[]},{"pwStepLine":17,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"Then I should see mastered words in the results","stepMatchArguments":[]},{"pwStepLine":18,"gherkinStepLine":14,"keywordType":"Action","textWithKeyword":"When I click \"Back to decks\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Back to decks\"","children":[{"start":9,"value":"Back to decks","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":19,"gherkinStepLine":15,"keywordType":"Action","textWithKeyword":"And I reload the app","stepMatchArguments":[]},{"pwStepLine":20,"gherkinStepLine":16,"keywordType":"Outcome","textWithKeyword":"Then I should see a saved session banner","stepMatchArguments":[]},{"pwStepLine":21,"gherkinStepLine":17,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck again","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":22,"gherkinStepLine":18,"keywordType":"Outcome","textWithKeyword":"Then none of the mastered words should appear in the quiz active pool","stepMatchArguments":[]}]},
]; // bdd-data-end