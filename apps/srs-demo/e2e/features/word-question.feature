Feature: Word question (MCQ)

  Background:
    Given the app is open with a clean session

  Scenario: A word question displays a prompt and four choices
    When I select the "let's eat something" deck
    Then I should see a word question with 4 choices

  Scenario: Answering correctly advances to the next question
    When I select the "let's eat something" deck
    And I note the word question prompt
    And I answer the word question correctly
    Then I should see a different question or the batch results screen

  Scenario: A wrong word answer is re-presented later in the same batch
    When I select the "let's eat something" deck
    And I note the word value from the cheat hint
    And I answer the word question incorrectly
    Then the same word should appear again before the batch ends
