Feature: Caption Group Management
  As a content creator using Ordio
  I want to group and edit captions like CapCut
  So that I can create seamless caption displays for my videos

  Background:
    Given a transcript with words
    And the transcript contains at least 12 words

  Scenario: Merge two caption groups together
    Given I have caption groups at indices 0 and 1
    When I merge down from group 0
    Then the groups should combine into a single group
    And the combined group should contain all words from both original groups
    And the start time should be the earliest start time
    And the end time should be the latest end time
    And the total number of groups should decrease by 1

  Scenario: Merged group bridges the gap between segments
    Given segment A ends at 2.0s and segment B starts at 4.0s
    When I merge down from group A
    Then the merged group should span from A.start to B.end
    And the 2.0s gap is preserved within the merged block

  Scenario: Merge a caption group with the previous group
    Given I have caption groups at indices 1 and 2
    When I merge up from group 2
    Then the groups should combine into a single group
    And the combined group text should contain words from both groups

  Scenario: Split a caption group at a specific word boundary
    Given I have a group with 6 words ["honestly", "if", "you're", "in", "this", "industry"]
    When I split at word position 4 ("this" stays with first group, "industry" starts the second)
    Then the first group should contain ["honestly", "if", "you're", "in", "this"]
    And the second group should contain ["industry"]
    And the second group's start time should equal the word "industry"'s start time
    And the first group's end time should equal the word "industry"'s start time
    And the total number of groups should increase by 1

  Scenario: Split at playhead time when playhead is in a gap between words
    Given words span [0.0-0.5s] and [1.0-1.5s]
    And the playhead is at 0.7s (in the silence gap)
    When I split at playhead time
    Then the split should find the next word starting at or after 0.7s
    And that word becomes the first word of the second segment

  Scenario: Cannot split a single-word group
    Given I have a group with only 1 word
    When I attempt to split it
    Then the group count should remain unchanged

  Scenario: Undo restores the previous caption state
    Given I have 2 caption groups
    When I merge down from group 0
    And I undo
    Then the caption groups should be restored to the pre-merge state

  Scenario: Redo re-applies the undone action
    Given I have 2 caption groups
    When I merge down from group 0
    And I undo
    And I redo
    Then the groups should be merged again

  Scenario: Select multiple caption groups for bulk operations
    Given I have at least 3 caption groups
    When I click on group 1 with multi-select enabled
    And I click on group 2 with multi-select enabled
    Then both groups should be selected
    And the selection count should be 2

  Scenario: Squeeze gaps between caption groups
    Given I have caption groups with gaps greater than 0.1s
    When I squeeze gaps with 0.1s threshold
    Then gaps should be reduced or eliminated
    And no caption groups should overlap

  Scenario: Expand gaps for readability
    Given I have caption groups with small gaps
    When I expand gaps to 0.2s minimum
    Then all gaps should be at least 0.2s
    And the total duration should increase

Feature: Caption Editor UI
  As a user editing captions
  I want a clear visual interface
  So that I can efficiently manage my captions

  Scenario: Display group rows with timing info
    Given I have caption groups
    When I view the caption editor
    Then each group should show as a row
    And each row should display the group text
    And each row should show start and end times

  Scenario: Click group to seek to position
    Given I have caption groups
    When I click on a group row
    Then playback should seek to that group's start time

Feature: Keyboard Shortcuts
  As an advanced user
  I want keyboard shortcuts for caption editing
  So that I can work more efficiently

  Scenario: Cmd+Z undoes the last caption action
    Given I have performed a merge
    When I press Cmd+Z
    Then the merge should be reversed

  Scenario: Cmd+Shift+Z redoes the last undone action
    Given I have performed and undone a merge
    When I press Cmd+Shift+Z
    Then the merge should be re-applied

  Scenario: Cmd+A selects all groups
    Given I have caption groups
    When I press Cmd+A (or Ctrl+A)
    Then all groups should be selected