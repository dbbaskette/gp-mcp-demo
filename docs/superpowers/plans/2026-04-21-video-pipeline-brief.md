# Video Pipeline Brief — Varied Persona Access Demo

Copy-paste values for the tanzu-video-pipeline scene-brief form.

## Objective *
Show how role-aware MCP access protects a Greenplum database: the same
natural-language prompt produces three visibly different answers across
viewer, analyst, and DBA personas, enforced by object GRANTs, statement
policy, and column masking simultaneously.

## Audience
Data platform leaders and security-minded engineers evaluating AI-to-
database connectors; Greenplum customers already running MCP server;
developers integrating Spring AI clients against the Greenplum MCP server.

## Duration (min)
5

## Scene Brief
6 scenes — all run in data-chat compare mode with viewer / analyst / dba
selected simultaneously. One prompt, three panes per scene.

1. Masking reveal — "Show me the first row from customer with c_customer_id,
   c_email_address, c_first_name, c_birth_year."
   Viewer sees [REDACTED] PII with last-4 customer ID. Analyst sees names
   clear but email and birth year as deterministic hashes. DBA sees
   everything clear. Demonstrates masking.yaml.

2. Scope reveal — "How many orders are in the web_sales table?"
   Viewer is denied at the Greenplum GRANT layer and stops. Analyst + DBA
   return counts.

3. Cross-table reveal — "Which item category generated the most revenue in
   2001 through the web channel?"
   Viewer still denied (web_sales). Analyst + DBA run the join.

4. Ops reveal — "Is store_sales healthy? Any bloat, skew, or stale stats?"
   Viewer + analyst have no diagnostics tools in their subset (soft-gated
   via personas.yaml allowedTools). DBA runs check_table_bloat /
   check_table_skew / check_stats_freshness.

5. ML reveal — "Train a classifier to predict customer purchase activity
   using customer and store_sales."
   Viewer declines (no ML tools). Analyst + DBA invoke gpmlbot_train and
   report a leaderboard.

6. Policy reveal — "Update the customer with c_customer_id='AAAAAAAABAAAAAAA'
   to set c_email_address='test@x.com'."
   Viewer + analyst blocked by policy.yaml readonly. DBA executes.

Login credentials (all password `password`):
- viewer@email.com   → role readonly (Greenplum user readonly_user)
- analyst@email.com  → role analyst  (Greenplum user analyst_user)
- dba@email.com      → role admin    (Greenplum user gpadmin)

Stack URL: https://localhost/chat/
Compare mode: use the persona toggles at the top of the chat UI to select
all three simultaneously before sending a prompt.
