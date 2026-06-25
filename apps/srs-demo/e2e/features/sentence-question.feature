Feature: Sentence question word-block

  Background:
    Given the app is open with a clean session

  Scenario: Sentence questions appear after words have been seen
    When I select the "let's eat something" deck
    And I answer all questions in the batch correctly
    And I click "Next Batch →"
    Then I should see a sentence question in the batch

  Scenario: Answering a sentence question correctly records the result
    When I select the "let's eat something" deck
    And I answer all questions in the batch correctly
    And I click "Next Batch →"
    And I answer all word and sentence questions in the batch correctly
    Then I should see the batch results screen

  Scenario: Submitting a correct sentence shows feedback before advancing
    When I select the "let's eat something" deck
    And I answer all questions in the batch correctly
    And I click "Next Batch →"
    And I skip MCQ questions to reach the sentence question
    And I submit the sentence correctly
    Then I should see correct sentence feedback
    And I should see a "Next" button

  Scenario: Submitting a wrong sentence shows incorrect feedback and the correct answer
    When I select the "let's eat something" deck
    And I answer all questions in the batch correctly
    And I click "Next Batch →"
    And I skip MCQ questions to reach the sentence question
    And I submit the sentence with wrong tile order
    Then I should see incorrect sentence feedback
    And I should see the correct answer displayed
    And I should see a "Next" button

  Scenario: A wrong sentence is re-presented later in the same batch
    When I select the "let's eat something" deck
    And I answer all questions in the batch correctly
    And I click "Next Batch →"
    And I skip MCQ questions to reach the sentence question
    And I note the sentence question prompt
    And I submit the sentence with wrong tile order
    And I click "Next" on the sentence feedback
    Then the same sentence should appear again before the batch ends
