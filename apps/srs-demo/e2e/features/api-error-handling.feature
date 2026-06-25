Feature: API error handling

  Scenario: App shows an error banner when the server is unreachable on load
    Given the API server is unreachable
    When I open the app
    Then I should see an API error banner

  Scenario: Clicking Resume shows an error banner when the server is unreachable
    Given the app is open with a clean session
    And I have a saved session
    And the API server is unreachable
    When I click "Resume"
    Then I should see an API error banner
