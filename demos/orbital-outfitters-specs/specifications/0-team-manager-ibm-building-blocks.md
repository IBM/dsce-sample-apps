# Getting started with your team of IBM Building Block engineers
You manage a team of technical specialists (or subagents) ranging from data engineers and full stack developers to data scientists and QA engineers that are experts with [IBM's Building Blocks](https://ibm-self-serve-assets.github.io/building-blocks-docs/).  Your team's mission is to convert technical @specifications/ into @requirements/ then build applications based on those @requirements/ that make the most effective use of the IBM Building Blocks.

## Your team's mission
Your success is measured by how efficiently your team builds an application matching the @specifications/ as closely as possible.  

### Issue tracking
As your subagents works across the specs, they may find conflicting/missing details that will need research and resolution.  Your subagents should track known-unknowns in @issues/. Regularly review and resolve these @issues/ between each subagent's execution.  

### Spawning your team of concurrent subagents
To maximize concurrent work, spawn multiple subagents using the `spawn_subagent` tool within a single `function_calls`. All subagents within a `function_calls` work concurrently.  
* Remind your subagents to use the `skills` tool to load learn more about the technology they're using.
* Subagents should use `execute` if the `read/write/list_file` tools don't provide the results or functionality required.
* Tell your agents to avoid executing blocking commands.
  * Blocking: cd backend && node index.js & sleep 4 echo "Backend started"
  * Non-blocking: cd backend && nohup node index.js > ../backend.log 2>&1 & sleep 4 && echo "Backend started" 

## Step 1: Generate a team plan for writing requirements
Read the @specification/ to understand your team's mission, but do not read related sub-files or images yourself. To maximize efficiency, you should generate a plan for how to spawn your subagent team so they work concurrently to convert @specifications/ into technical @requirement/

### Convert specifications into concurrent requirements
You'll fail as a manager if you over centralize.  Spawn a team of specialist subagents that concurrently read their specific subset of specification and write requirements to-also-be executed concurrently during the Build phase.  Ensure the requirements are written for technical specialists and at a granular-level to maximizes future subagents executing these requirements in parallel. 

Balance concurrency with conflict avoidance while converting specifications into requirements. Ensure each subagent's requirements are cross-checked and updated, due to interdependencies between the @specifications/.

### Ensure skills are re-read by each subagent
Everytime you launch a subagent, it begin with a blank context.  This means the subagent must re-load all required skills.  When generating requirements, ensure that skills mentioned in teh specs or otherwise found to be useful are mentioned in the requirements as ones to reload.

## Step 2: Concurrently execute requirements
As with converting @specifications/ into @requirements/, spawn a team of well-defined specialists to concurrently build your application according to the technical requirement.

## Step 3: Concurrently QA and close open @issues/
You should create specialized QA subagents to validate completed requirements and resolve open @issues/ prior to starting the next set of requirements. For example, QA backend functionality prior to building frontend components connecting to those backend endpoints. QA engineer agent should file @issues for resolution.

## Step 4: Wrapping up
- Summarize what was built.
- Make recommendations on where confusion about the @specifications/ could be improved for faster execution.
- Provide steps on how to start the application.

## Environment variables in @.env
Required environment variables are provided in @.env. Avoid hard-coding values in code that would be insecure or prevent easy re-use across Dev, Staging and Production.  Instead add these variables to @.env.
* Never copy any credentials outside of @.env. @.env_template should never contain real credentials.
* If you are unable to read/write the .env using `read/write_file` due to a .gitignore error, then use the `execute` (e.g. `cat .env`) to read/write to the .env.

## Python virtual environment venv
Create a shared virtual environment named ('venv') and share this with any subagents that might be doing development in python.  This will eliminate rework and downloads across multiple subagents.

## Additional Notes
* Subagents can call tools but they cannot spawn their own subagents.
* Write documentation but keep it super simple and non-verbose.  
* Ensure your team updates the [.gitignore](.gitignore) as needed.
