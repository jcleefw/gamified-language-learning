Feature: SRS word shelving policy

  Background:
    Given the app is open with a clean session
    And the shelving config is reset to defaults

  Scenario: Word shelved after N stagnant batches
    Given the scenario "mid-session-stagnation" is loaded
    When I select the "let's eat something" deck
    And I answer all word questions in the batch incorrectly
    And I click "Next Batch →"
    And I answer all word questions in the batch incorrectly
    And I click "Next Batch →"
    Then some words should be shelved for "deck-eat"

  Scenario: Shelved word excluded from quiz questions
    Given the scenario "stagnant-word-ready-to-shelve" is loaded
    When I select the "let's eat something" deck
    And I answer all word questions in the batch incorrectly
    And I click "Next Batch →"
    Then some words should be shelved for "deck-eat"
    And shelved words should not appear as quiz questions

  Scenario: maxShelved cap enforced
    Given the scenario "two-words-shelved-cap-reached" is loaded
    When I select the "let's eat something" deck
    And I answer all word questions in the batch incorrectly
    And I click "Next Batch →"
    Then no more than 2 words should be shelved for "deck-eat"

  Scenario: New session unshelves previously shelved words
    Given the scenario "fresh-session-with-shelved-words" is loaded
    When I select the "let's eat something" deck
    Then no words should be shelved for "deck-eat"

  Scenario: Cross-deck isolation
    Given the scenario "cross-deck-isolation" is loaded
    When I select the "let's eat something" deck
    And I answer all word questions in the batch incorrectly
    And I click "Next Batch →"
    Then some words should be shelved for "deck-eat"
    And no words should be shelved for "deck-weather"

  Scenario: Stagnation counters survive mid-session refresh
    Given the scenario "mid-session-stagnation" is loaded
    When I select the "let's eat something" deck
    And I answer all word questions in the batch incorrectly
    And I reload the app
    And I resume the saved session
    And I answer all word questions in the batch incorrectly
    And I click "Next Batch →"
    Then some words should be shelved for "deck-eat"

  Scenario: Shelving state persists across app restart
    Given the scenario "stagnant-word-ready-to-shelve" is loaded
    When I select the "let's eat something" deck
    And I answer all word questions in the batch incorrectly
    And I click "Next Batch →"
    Then some words should be shelved for "deck-eat"
    When I reload the app
    And I resume the saved session
    Then some words should be shelved for "deck-eat"
