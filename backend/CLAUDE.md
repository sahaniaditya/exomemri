# CLAUDE.md

This is to help claude get familiar with backend architecture and design principles, this project is using. 

## Coding Style

### Table Creation
While creating any new table migrations, please try to follow the database design rules. Don't create table with too many columns. If we can split tables into multiple one and connect each -> do that. Split strictly only when number of 
columns is greater than 10. Try to follow cascading while table creation so that if any space, user is deleted -> everything
related to it is deleted automatically. 

### Schema Validation
We are using FastAPI for backend. Every response and request has to go and validate through schemas. 

### APIs 
Always try to write fast and optimized api endpoints. Every API call should be validated against user session so that we are 
maintaining our security standards. 

### Structure
While writing backend code, services, apis -> try to follow the best system design principles feasible to write the code. Don't 
try to write everything in one file. Try to maintain folder structure. APIs goes separately, services goes separately, constants
goes separately, permissions goes separately. 


## Architecture


