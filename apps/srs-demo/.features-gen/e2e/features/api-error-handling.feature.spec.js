// Generated from: e2e/features/api-error-handling.feature
import { test } from "playwright-bdd";

test.describe('API error handling', () => {

  test('App shows an error banner when the server is unreachable on load', async ({ Given, When, Then, page }) => { 
    await Given('the API server is unreachable', null, { page }); 
    await When('I open the app', null, { page }); 
    await Then('I should see an API error banner', null, { page }); 
  });

  test('Clicking Resume shows an error banner when the server is unreachable', async ({ Given, When, Then, And, page }) => { 
    await Given('the app is open with a clean session', null, { page }); 
    await And('I have a saved session', null, { page }); 
    await And('the API server is unreachable', null, { page }); 
    await When('I click "Resume"', null, { page }); 
    await Then('I should see an API error banner', null, { page }); 
  });

});

// == technical section ==

test.use({
  $test: [({}, use) => use(test), { scope: 'test', box: true }],
  $uri: [({}, use) => use('e2e/features/api-error-handling.feature'), { scope: 'test', box: true }],
  $bddFileData: [({}, use) => use(bddFileData), { scope: "test", box: true }],
});

const bddFileData = [ // bdd-data-start
  {"pwTestLine":6,"pickleLine":3,"tags":[],"steps":[{"pwStepLine":7,"gherkinStepLine":4,"keywordType":"Context","textWithKeyword":"Given the API server is unreachable","stepMatchArguments":[]},{"pwStepLine":8,"gherkinStepLine":5,"keywordType":"Action","textWithKeyword":"When I open the app","stepMatchArguments":[]},{"pwStepLine":9,"gherkinStepLine":6,"keywordType":"Outcome","textWithKeyword":"Then I should see an API error banner","stepMatchArguments":[]}]},
  {"pwTestLine":12,"pickleLine":8,"tags":[],"steps":[{"pwStepLine":13,"gherkinStepLine":9,"keywordType":"Context","textWithKeyword":"Given the app is open with a clean session","stepMatchArguments":[]},{"pwStepLine":14,"gherkinStepLine":10,"keywordType":"Context","textWithKeyword":"And I have a saved session","stepMatchArguments":[]},{"pwStepLine":15,"gherkinStepLine":11,"keywordType":"Context","textWithKeyword":"And the API server is unreachable","stepMatchArguments":[]},{"pwStepLine":16,"gherkinStepLine":12,"keywordType":"Action","textWithKeyword":"When I click \"Resume\"","stepMatchArguments":[{"group":{"start":8,"value":"\"Resume\"","children":[{"start":9,"value":"Resume","children":[{}]},{"children":[{}]}]},"parameterTypeName":"string"}]},{"pwStepLine":17,"gherkinStepLine":13,"keywordType":"Outcome","textWithKeyword":"Then I should see an API error banner","stepMatchArguments":[]}]},
]; // bdd-data-end