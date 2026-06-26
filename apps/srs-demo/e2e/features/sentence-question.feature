Feature: Sentence question word-block

  Background:
    Given the app is open with a clean session
    And the shelving config is reset to defaults

  Scenario: Sentence questions appear in batch when words are pre-seeded as seen
    Given the scenario "minimal-sentence-ready" is loaded
    When I select the "let's eat something" deck
    Then I should see a sentence question in the batch
