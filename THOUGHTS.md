context of what we're building
- building a language agnostic learning app. Can support multi language
- learning materials are structured in conversational. Then learn each word in the conversation
- learning by remember vocabulary through gamified quizes
- strengthening with SRS memory model
- leverage AI (gemini api) to generate conversational content




Goals/Intents:
- grammartically correct is not the main focus. words understanding is more important
- Native speakers are really happy when they hear a foreigner intentionally learning their language. They don't care about grammars. 
- Foreigners can spit out words that native speakers can understand, that's enough for communication
- If they want to be grammartically correct,  that's why each set is breakdowns from a conversation
- killing 2 birds with one stone


Target audience:
- Tourist that would like to learn some words before travelling to a foreign country
- serious language learners that would like retain memories of words and sentence structures
- Any one that would like to learn language as a hobby
- english or romanic reading speaker users for now

Project build intention:
- This project is intended to rely on agents to fully build it.
- this is so that i can experience and learn how a handsoff vibe coding is done. 
- this will be a Spec-Driven-Development
- there are hard constraints that I dont like about agentic flow when it comes to debugging and writing test (unit test, BDD test). prompt me for discussion
- What i need from you, look through the markdown and setup of the codebase, guide me through on how to setup a full agentic experience. how to kick start an agent to perform a task end to end
- i want to run a full analysis on whether this project should setup for specifically using claude ecosystem as the only agent, or more open to other agentic agnostic where i can use different ecosystem swap.
- Cost effectiveness is very important. There are times i will prefer to be handson rather than letting agents run wild 


What are the feature's available app?
Admin path:
- "Content Curation" where (phase 1 curator admin only, phase 2 open to paid users)
    - a topic is provided, configurable conversation length, difficulties, formalities
    - based on conversation generated, words are broken down with meaning
    - based on conversation generated, use Gemini API TTS model to generate "natural" conversation
    - using different model to verify "correctness" of generated conversation

- "user management" where admins can manage users
    - create, update, delete users
    - assign roles to users
    - view user activity
    - 3 types of users: admin, curator, learner

- Authentication flow
    ├─ Google OAuth Sign-In
    │  ├─ JWT callback → findUserByEmail()
    │  ├─ Found → embed role, check isActive, update lastLoginAt
    │  └─ Not found → auto-create { role: 'user', passwordHash: null, authProvider: 'google' }
    │
    ├─ Credentials Sign-In
    │  ├─ authorize() → findUserByEmail()
    │  ├─ Not found → return null (reject)
    │  ├─ Found, !isActive → return null (reject)
    │  ├─ Found, passwordHash is null → return null (Google-only user)
    │  └─ Found → bcrypt.compare(password, passwordHash) → success/fail


Learning path:
- "SRS learning" where users train their memory through gamified quizzes. 
    - types of quizzes questions: 
        - multiple choice
        - word block selection sentence
        - audio recognition
    - quizes question frequency: 
        - 20% of questions are from foundational deck 
        - 80% of questions are from curated content
        - out of the 80%, 50% multiple choice, 10% word block selection, 10% audio recognition (if available), 20% are from revision deck (words that need more practice)
        - if foundational deck is not 100% learned, don't show word block selection with native writing. User won't be able to answer the question correctly. rememer it's 100% learned, not mastery
    - SRS (Spaced Repetition System)
        - quiz results are stored in SRS memory model  
        - quiz results are used to determine which words to quiz next
        - follow the ANKI algorithm for scheduling reviews
        - each word is tested at least 10 times to mastery
        - each mistake of the word will minus the mastery count
        - mastered words will return after certain period of time for revision
        - each word is tested with combination of native writing, romanized phonetic, english translation and audio sound
    - quiz decks have 
        - quiz deck size: 15 questions per quiz
        - deck can be broken into batches of 15 words
        - different types 
            - 1. conversational broke down words from curated content
            - 2. conversational words learned and select for revision
            - 3. revised learned words as a pool of words to quiz (no longer care about the conversation category they're in)
            - 4. user can create their own quiz decks (implement last)
            - 5. users can take quiz on their learned words
            - 6. foundation deck for consonants, vowels, and tones for some specific languages like chinese, thai etc
        - the default quiz deck is the curated content
        - user created deck and revision deck are seperated from the curated content on a seperate page.
        - special case for foundational 
            - foundation deck is always available to all users
            - randomly pick 3 from foundational deck and insert into curated content. It is important to learn foundational words, but we don't want to overwhelm the user with too many foundational words. Once 3 foundation words are selected into curated content, do not introduce new foundation words until the current 3 are mastered.
            - foundational deck mastery is tracked separately from curated content mastery. Mastery is out of 5, not 10.
            
    
    
    
---
What is the platform this is built for?
2 parts to this 
- learning will be can be in mobile view on web
- curation and admin stuff in web only
- since it might be used in mobile mostly, the creation of components should be as close to how mobile app will be written in  Native as much as possible

---
what tech?
- this section will need discussion with architect
- i would like to use VUE js for this project. But i'm uncertain how would this work with mobile native app. 

Cloud option: Cloudflare Free tier
- Audio storage
    - local: use mini-o
    - cloud: use cloudflare s3
    - need a strategy to store audio according to content curation
- database
    - use mongo db. prefer to stay in cloudflare for db cloud
    - needs for user managements, srs progress, audio generation count, audio path
- web app location
    

- db - mongodb as database.  
- CI/CD - git action vs cloudflare hooks
- AI model for curation - gemini API as first AI model to integrate. Would use local llm too
- s3 bucket integration. mainly to store audio generated files
- Audio generated files - cost analysis on storage, generation of audio conversation by conversation, sentence by sentences and word by word
- zod for type validation
- hono for backend if needed
- date library
- eslint library
- function library like lodash (alternative)



---
What is the UI framework to use. Why?
- NO tailwind css. too bloated with classes in my browser DOM
- prefer something like RAdix, Chakra with more css in js way of doing things. This way a lot of the styling are typed too
- avoid having to write css modules. 
- storybook setup, but i prefer alternative (need some research)

## component structure systems: Atomic design structure
## Atomic system guidelines

### atoms

- simple wrapper that consist only 1 chakra component.
- components that stems out from the same parent component eg Breadcrumb.Root, Breadcrumb.List, Breadcrumb.Item are allowed
- only 1 useState is allowed. Avoid as much as possible.
- MUST have .stories.tsx file
- pure function component only. Events handler like onClick, onChange should be controlled from external
- **Use semantic tokens** — Never hardcode colours, shadows, or z-index values. Reference CSS custom properties.

### molecules

- components that consist 2 or more component but doesn't have complex state management
- < 3 useState is allowed
- MUST have .stories.tsx file

### organisms

- most complex of all. consist 2 or more component
- .stories file is optional

## Component Stories

- do not create stories about id or ARIA attributes
- always declare a default props on the top to reduce repeated stories wrapper. See `src/components/AudioSourcesPanel/AudioSourcesPanel.stories.tsx`
- each stories.tsx should export a title according to their atomic category. eg.

  ```tsx
  export default {
    title: '{Atoms}/{COMPONENT_NAME}',
  };
  ```

challenges: 
1. setting up theme-ing is difficult. but i now have some html wireframes on how i want the overall feel to look like. 
2. I would like less customization in component styling and more generic components reusable. use more concept of recipes
3. how to get agentic to create skills that do that. Do i need a UI framework expert consultant?



---

what are the rules for agent?

what are the skills i want to setup before starting

what is the implementation approach?

What is the planning approach?

what CI/CD strategy?

What storage strategy?

how to do testing
- unit test is a must for all functions


hooks usage
- a component should never exceed more than 3 states. Anything beyond that create a useXXX hook. 
- before creating any hooks, make sure to existing functions with similar functionality. I expect this to be discovered when investigation of implementation is happening. Ask yourself is it necessary. can i reuse existing
- hooks are store in generic hooks/ 



