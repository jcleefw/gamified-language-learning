---
name: stakeholder-interview-guide
description: Generate a targeted interview guide for requirements elicitation with a specific stakeholder. Use when preparing for a discovery or requirements session.
model: haiku
---

Create an interview guide for: $ARGUMENTS

If no input is provided, stop and ask:
1. "Who is the stakeholder? (Role, team, and their relationship to the system or process)"
2. "What is the focus area — a new feature, a process change, a pain point, or a system?"
3. "What do we already know? (Provide any context, prior research, or working assumptions)"

---

## Output Structure

### Interview Context
- **Stakeholder**: Role and team
- **Goal of this interview**: What decisions will this session inform?
- **Suggested duration**: [30 / 45 / 60 min]

### Opening (5 min)
Brief framing questions to establish rapport and confirm context:
1. Can you describe your role and how you interact with [area of focus]?
2. How often do you deal with [process/system]? What does a typical interaction look like?

### Core Questions
Grouped by theme. Each question is open-ended — designed to surface the stakeholder's actual experience, not confirm assumptions.

**[Theme 1: Current State]**
1. Walk me through how you currently [do X]. What happens at each step?
2. Where does this process work well? Where does it break down?
3. When something goes wrong, what does that look like?

**[Theme 2: Pain Points & Priorities]**
1. What takes longer than it should?
2. What do you have to work around?
3. If you could change one thing today, what would it be?

**[Theme 3: Requirements & Constraints]**
1. What does a successful outcome look like for you?
2. Are there rules, regulations, or policies that shape how this must work?
3. What would make you unwilling to adopt a new solution?

**[Theme 4: Stakeholders & Dependencies]**
1. Who else is affected by how this works?
2. Who has the final say on [decision area]?
3. Are there upstream or downstream systems we should understand?

### Probing Questions (use as needed)
- "Can you give me an example of that?"
- "How often does that happen?"
- "What do you do when that occurs?"
- "Who else would know more about this?"
- "What would need to be true for that to work?"

### Closing (5 min)
1. Is there anything I haven't asked that you think is important?
2. Who else should we speak with?
3. Are there any documents, reports, or examples you can share?

### Note-Taking Template
Space to capture during the interview:
- Key quotes (verbatim where possible)
- Surprises or contradictions to prior assumptions
- Follow-up items

---

## Constraints

- Questions must be open-ended — avoid yes/no questions
- Do not lead the stakeholder toward a predetermined solution — questions should surface their experience, not validate yours
- Flag any question that rests on an unconfirmed assumption with "[Assumption — adjust if wrong]"
- Limit to 8–12 core questions — depth over breadth
