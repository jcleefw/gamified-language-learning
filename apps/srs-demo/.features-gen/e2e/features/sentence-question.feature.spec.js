// Generated from: e2e/features/sentence-question.feature
import { test } from "playwright-bdd";

test.describe('Sentence question word-block', () => {

  test.beforeEach('Background', async ({ Given, page }, testInfo) => { if (testInfo.error) return;
    await Given('the app is open with a clean session', null, { page }); 
  });
  
  test('Sentence questions appear after words have been seen', async ({ When, Then, And, page }) => { 
    await When('I select the "let\'s eat something" deck', null, { page }); 
    await And('I answer all questions in the batch correctly', null, { page }); 
    await And('I click "Next Batch →"', null, { page }); 
    await Then('I should see a sentence question in the batch', null, { page }); 
  });

  test('Answering a sentence question correctly records the result', async ({ When, Then, And, page }) => { 
    await When('I select the "let\'s eat something" deck', null, { page }); 
    await And('I answer all questions in the batch correctly', null, { page }); 
    await And('I click "Next Batch →"', null, { page }); 
    await And('I answer all word and sentence questions in the batch correctly', null, { page }); 
    await Then('I should see the batch results screen', null, { page }); 
  });

  test('Submitting a correct sentence shows feedback before advancing', async ({ When, Then, And, page }) => { 
    await When('I select the "let\'s eat something" deck', null, { page }); 
    await And('I answer all questions in the batch correctly', null, { page }); 
    await And('I click "Next Batch →"', null, { page }); 
    await And('I skip MCQ questions to reach the sentence question', null, { page }); 
    await And('I submit the sentence correctly', null, { page }); 
    await Then('I should see correct sentence feedback', null, { page }); 
    await And('I should see a "Next" button', null, { page }); 
  });

  test('Submitting a wrong sentence shows incorrect feedback and the correct answer', async ({ When, Then, And, page }) => { 
    await When('I select the "let\'s eat something" deck', null, { page }); 
    await And('I answer all questions in the batch correctly', null, { page }); 
    await And('I click "Next Batch →"', null, { page }); 
    await And('I skip MCQ questions to reach the sentence question', null, { page }); 
    await And('I submit the sentence with wrong tile order', null, { page }); 
    await Then('I should see incorrect sentence feedback', null, { page }); 
    await And('I should see the correct answer displayed', null, { page }); 
    await And('I should see a "Next" button', null, { page }); 
  });

  test('A wrong sentence is re-presented later in the same batch', async ({ When, Then, And, page }) => { 
    await When('I select the "let\'s eat something" deck', null, { page }); 
    await And('I answer all questions in the batch correctly', null, { page }); 
    await And('I click "Next Batch →"', null, { page }); 
    await And('I skip MCQ questions to reach the sentence question', null, { page }); 
    await And('I note the sentence question prompt', null, { page }); 
    await And('I submit the sentence with wrong tile order', null, { page }); 
    await And('I click "Next" on the sentence feedback', null, { page }); 
    await Then('the same sentence should appear again before the batch ends', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/features/sentence-question.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":10,"pickleLine":6,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","isBg":true,"stepMatchArguments":[]},{"pwStepLine":11,"gherkinStepLine":7,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":12,"gherkinStepLine":8,"keywordType":"Action","textWithKeyword":"And I answer all questions in the batch correctly","stepMatchArguments":[]},{"pwStepLine":13,"gherkinStepLine":9,"keywordType":"Action","textWithKeyword":"And I click \"Next Batch →\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Next Batch →\"","children":[{"start":9,"value":"Next Batch →","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":14,"gherkinStepLine":10,"keywordType":"Outcome","textWithKeyword":"Then I should see a sentence question in the batch","stepMatchArguments":[]}]},
  {"pwTestLine":17,"pickleLine":12,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","isBg":true,"stepMatchArguments":[]},{"pwStepLine":18,"gherkinStepLine":13,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":19,"gherkinStepLine":14,"keywordType":"Action","textWithKeyword":"And I answer all questions in the batch correctly","stepMatchArguments":[]},{"pwStepLine":20,"gherkinStepLine":15,"keywordType":"Action","textWithKeyword":"And I click \"Next Batch →\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Next Batch →\"","children":[{"start":9,"value":"Next Batch →","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":21,"gherkinStepLine":16,"keywordType":"Action","textWithKeyword":"And I answer all word and sentence questions in the batch correctly","stepMatchArguments":[]},{"pwStepLine":22,"gherkinStepLine":17,"keywordType":"Outcome","textWithKeyword":"Then I should see the batch results screen","stepMatchArguments":[]}]},
  {"pwTestLine":25,"pickleLine":19,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","isBg":true,"stepMatchArguments":[]},{"pwStepLine":26,"gherkinStepLine":20,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":27,"gherkinStepLine":21,"keywordType":"Action","textWithKeyword":"And I answer all questions in the batch correctly","stepMatchArguments":[]},{"pwStepLine":28,"gherkinStepLine":22,"keywordType":"Action","textWithKeyword":"And I click \"Next Batch →\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Next Batch →\"","children":[{"start":9,"value":"Next Batch →","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":29,"gherkinStepLine":23,"keywordType":"Action","textWithKeyword":"And I skip MCQ questions to reach the sentence question","stepMatchArguments":[]},{"pwStepLine":30,"gherkinStepLine":24,"keywordType":"Action","textWithKeyword":"And I submit the sentence correctly","stepMatchArguments":[]},{"pwStepLine":31,"gherkinStepLine":25,"keywordType":"Outcome","textWithKeyword":"Then I should see correct sentence feedback","stepMatchArguments":[]},{"pwStepLine":32,"gherkinStepLine":26,"keywordType":"Outcome","textWithKeyword":"And I should see a \"Next\" button","stepMatchArguments":[{"group":{"start":15,"value":"\"Next\"","children":[{"start":16,"value":"Next","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":35,"pickleLine":28,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","isBg":true,"stepMatchArguments":[]},{"pwStepLine":36,"gherkinStepLine":29,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":37,"gherkinStepLine":30,"keywordType":"Action","textWithKeyword":"And I answer all questions in the batch correctly","stepMatchArguments":[]},{"pwStepLine":38,"gherkinStepLine":31,"keywordType":"Action","textWithKeyword":"And I click \"Next Batch →\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Next Batch →\"","children":[{"start":9,"value":"Next Batch →","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":39,"gherkinStepLine":32,"keywordType":"Action","textWithKeyword":"And I skip MCQ questions to reach the sentence question","stepMatchArguments":[]},{"pwStepLine":40,"gherkinStepLine":33,"keywordType":"Action","textWithKeyword":"And I submit the sentence with wrong tile order","stepMatchArguments":[]},{"pwStepLine":41,"gherkinStepLine":34,"keywordType":"Outcome","textWithKeyword":"Then I should see incorrect sentence feedback","stepMatchArguments":[]},{"pwStepLine":42,"gherkinStepLine":35,"keywordType":"Outcome","textWithKeyword":"And I should see the correct answer displayed","stepMatchArguments":[]},{"pwStepLine":43,"gherkinStepLine":36,"keywordType":"Outcome","textWithKeyword":"And I should see a \"Next\" button","stepMatchArguments":[{"group":{"start":15,"value":"\"Next\"","children":[{"start":16,"value":"Next","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]}]},
  {"pwTestLine":46,"pickleLine":38,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","isBg":true,"stepMatchArguments":[]},{"pwStepLine":47,"gherkinStepLine":39,"keywordType":"Action","textWithKeyword":"When I select the \"let's eat something\" deck","stepMatchArguments":[{"group":{"start":13,"value":"\"let's eat something\"","children":[{"start":14,"value":"let's eat something","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":48,"gherkinStepLine":40,"keywordType":"Action","textWithKeyword":"And I answer all questions in the batch correctly","stepMatchArguments":[]},{"pwStepLine":49,"gherkinStepLine":41,"keywordType":"Action","textWithKeyword":"And I click \"Next Batch →\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Next Batch →\"","children":[{"start":9,"value":"Next Batch →","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":50,"gherkinStepLine":42,"keywordType":"Action","textWithKeyword":"And I skip MCQ questions to reach the sentence question","stepMatchArguments":[]},{"pwStepLine":51,"gherkinStepLine":43,"keywordType":"Action","textWithKeyword":"And I note the sentence question prompt","stepMatchArguments":[]},{"pwStepLine":52,"gherkinStepLine":44,"keywordType":"Action","textWithKeyword":"And I submit the sentence with wrong tile order","stepMatchArguments":[]},{"pwStepLine":53,"gherkinStepLine":45,"keywordType":"Action","textWithKeyword":"And I click \"Next\" on the sentence feedback","stepMatchArguments":[]},{"pwStepLine":54,"gherkinStepLine":46,"keywordType":"Outcome","textWithKeyword":"Then the same sentence should appear again before the batch ends","stepMatchArguments":[]}]},
]; // bdd-data-end