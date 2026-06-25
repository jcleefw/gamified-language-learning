Feature: SRS session mastery progression

  Background:
    Given the app is open with a clean session

  Scenario: Re-entering a deck after mastering words shows new words
    When I select the "let's eat something" deck
    And I answer all questions in the batch correctly
    And I click "Next Batch →"
    And I answer all questions in the batch correctly
    And I click "Next Batch →"
    And I answer all questions in the batch correctly
    Then I should see mastered words in the results
    When I click "Back to decks"
    And I reload the app
    Then I should see a saved session banner
    When I select the "let's eat something" deck again
    Then none of the mastered words should appear in the quiz active pool
