# Context Bonsai Agent Spec

## Purpose

This document defines the cross-agent behavioral contract for Context Bonsai.
It is intended to be broad enough to guide implementations for multiple coding agents while remaining concrete enough to drive per-agent implementation plans.

The reference behavior comes primarily from the working OpenCode implementation, with Claude Code validation and architecture constraints informing portability requirements.

## Scope

This spec covers:

- model-visible pruning behavior
- retrieval behavior
- archive placeholder rendering
- context-pressure gauge behavior
- system-guidance requirements
- runtime capability requirements and degradation behavior
- validation and end-to-end parity expectations

This spec does not require identical internal architecture across agents.
Behavioral parity matters more than code-level similarity.

## Product Goal

Context Bonsai allows an LLM coding agent to reclaim context surgically instead of relying only on host-level overflow compaction.
The agent archives stale contiguous conversation ranges, leaves behind a compact placeholder with enough semantic breadcrumbs to continue working, and can later restore the archived content if needed.

## Core Principles

- Behavioral parity is defined from the model's perspective, not by internal implementation details.
- Minimize upstream or host-core changes. Prefer plugin-side, extension-side, or MCP-side implementations whenever they can satisfy the behavioral contract.
- Pruning is non-destructive. Archived content remains recoverable.
- One prune call archives one contiguous range.
- Protected context is preserved unless drift and safety rules explicitly permit otherwise.
- Gauge signals must reach the model in-band. Human-only indicators are not sufficient.
- Missing required runtime primitives must fail closed with explicit, deterministic errors.
- Implementations may use plugins, patches, extensions, MCP, or other transport mechanisms as needed, provided the model-visible contract remains intact.

## Change-Minimization Rule

Context Bonsai implementations MUST prefer the narrowest viable integration surface.

- First choice: plugin, extension, hook, or other supported host-side integration point.
- Second choice: MCP or equivalent sidecar transport when tools need to be exposed without modifying upstream tool registration paths.
- Last resort: upstream or host-core patches.

Upstream or host-core changes are acceptable only when a required behavioral capability cannot be delivered from the plugin-side or sidecar-side, and the missing capability is explicitly identified.

When host-core changes are required, the implementation plan SHOULD:

- minimize touched upstream files
- isolate the change to a small, capability-enabling seam
- avoid broad refactors unrelated to bonsai
- document why plugin-side or MCP-side approaches were insufficient

## Terminology

- `anchor`: the first message in an archived range. The archive metadata is attached to or keyed by this message.
- `range end`: the last message in an archived range.
- `archive`: persisted metadata describing one pruned contiguous range.
- `placeholder`: the compact transcript representation shown to the model in place of archived content.
- `protected anchor`: operational-rule or session-goal content that is kept by default.
- `unresolved task marker`: content indicating work is still in progress and should normally remain in context.
- `usable budget`: context budget available for active transcript content after reserving headroom for model output.

## User Model

The gamuts below name representative users and needs that the spec — and in particular the Operator Documentation Contract — is meant to serve. The lists are illustrative, not exhaustive.

### User Gamut

- Senior security engineer auditing what the install touches and what data leaves the box.
- Non-developer creator (PM, designer, hobbyist) building software through coding agents — runs commands when shown them step-by-step but does not already know `git clone` / `npm install` / equivalents on their own. The docs must teach the moves.
- Existing developer adopter who knows the terminal but is new to Context Bonsai.

### User-Needs Gamut

- Reproducibility on a clean machine without prior project context.
- Concrete copy-paste commands for each platform the port supports.
- A post-install verification step that confirms bonsai is wired in (e.g., a smoke prompt plus expected response shape).
- Security disclosure: what data the extension reads, where state persists, what is transmitted to the LLM provider (placeholder summary and index terms YES; archived original content NO), and any network egress the extension initiates separately from the host.
- Uninstall procedure that returns the host to its pre-install state.

## Required User Outcomes

- The agent can prune stale conversation history without losing recoverability.
- The agent can later retrieve archived content by anchor identifier.
- The model receives enough guidance to prune safely and autonomously.
- The model receives context-pressure signals before host compaction becomes the only option.
- Archived state survives the persistence model used by the host agent, such as session reload, resume, or process restart, when that host supports session persistence.

## Behavioral Contract

### 1. System Guidance

Each implementation MUST provide system-level guidance telling the model:

- that `context-bonsai-prune` and `context-bonsai-retrieve` exist
- that pruning uses pattern boundaries, not internal ranking disclosure
- which content is protected by default
- how to prioritize prune candidates
- how recency and drift affect pruning decisions
- that pruning is non-destructive and retrieval remains available

The guidance SHOULD preserve the OpenCode semantics unless the host requires minor wording adaptation.
If wording changes, the meaning of the protected-context, ranking, drift, and execution rules MUST remain equivalent.

### 2. Prune Tool

The prune tool MUST be exposed to the model as `context-bonsai-prune`.

#### Required inputs

- `from_pattern`: string
- `to_pattern`: string
- `summary`: string
- `index_terms`: array of strings

#### Optional input

- `reason`: string

#### Input rules

- ID-based selectors MUST NOT be the primary contract.
- If an implementation previously exposed ID selectors, it MUST reject them deterministically rather than silently accepting them.
- `from_pattern` and `to_pattern` must both be present.
- `summary` must be non-empty after trim.
- `index_terms` must be a non-empty array of non-empty strings after trim.
- The tool MUST resolve each pattern to exactly one boundary before any mutation occurs.
- Boundary ambiguity or failure to resolve MUST return a deterministic error and perform no mutation.

#### Execution rules

- One call archives one contiguous range.
- The resolved start must not come after the resolved end.
- The selected range MUST NOT cut through incomplete or malformed tool-call history.
- The selected range MUST NOT start or end inside an already-pruned range.
- Mutation MUST be atomic from the model-visible perspective.
- On success, the archive metadata is persisted and the next transformed transcript shows a placeholder instead of the archived content.

#### Output rules

- Success output SHOULD include the resolved range and summarize what was archived.
- Failure output MUST be plain text, deterministic, and actionable.
- Failure output MUST NOT mutate transcript state.

### 3. Retrieve Tool

The retrieve tool MUST be exposed to the model as `context-bonsai-retrieve`.

#### Required input

- `anchor_id`: string

#### Execution rules

- Retrieval restores the full inclusive range from the anchor through the stored range end.
- Retrieval succeeds only if the referenced anchor is archived.
- If the archive was created in the same model step or turn, the implementation SHOULD reject immediate retrieval with a deterministic same-step guard error.
- Retrieval mutation MUST be atomic from the model-visible perspective.

#### Output rules

- Success output SHOULD indicate the restored range.
- Missing anchor or missing archive state MUST return deterministic plain-text errors.

### 4. Archive Placeholder Rendering

When a range is pruned, the model-facing transcript MUST replace the anchor message with a compact placeholder and omit the archived follower messages through the range end.

The placeholder MUST contain:

- the anchor identifier
- the range-end identifier
- the summary
- the index terms

The canonical placeholder shape is:

```text
[PRUNED: <anchor-id> to <range-end-id>]
Summary: <summary>
Index: <term1>, <term2>, ...
```

Minor formatting differences are acceptable if the same information remains clearly visible to the model.

### 5. Archive Persistence Model

Each implementation MUST persist archive state in a host-appropriate way.

The persisted archive record MUST include at least:

- anchor identifier
- range-end identifier
- summary
- index terms
- optional reason if provided

If the host transcript cannot be re-correlated by raw message id alone, the implementation MUST persist enough additional correlation data to render placeholders reliably on later turns or reloads.
Examples include role plus timestamp, session entry id, branch information, or host-native message metadata.

### 6. Context Transform Requirement

Each implementation MUST have a mechanism that rewrites the model-visible transcript before the next model invocation so that:

- archive placeholders appear in place of archived ranges
- archived follower messages are omitted
- retrieval removes the placeholder effect and restores the original visible range
- gauge text can be inserted in-band when cadence and usage conditions are met

The exact hook varies by host. Examples include message transforms, context events, runtime patch points, or equivalent transcript-rewrite stages.

### 7. Gauge Requirement

The implementation MUST provide an in-band context-pressure gauge that the model can see.

#### Gauge semantics

- Gauge cadence is every 5 turns by default.
- Gauge content is based on used tokens versus usable budget.
- Gauge text MUST be injected into model-visible context, preferably appended to the last user message inside a system-reminder-style wrapper.
- Human-visible status bars, footers, or logs MAY be added, but they do not satisfy this requirement on their own.

#### Locked severity bands

- `<30%`: informational continue-working guidance
- `30-60%`: prune-ready advisory
- `61-80%`: stronger reminder including recency and drift cues
- `>80%`: explicit urgent prune language, including `PRUNE NOW`

The current working implementations use four bands. Future variants may add more nuance, but the default parity target for new agent ports is these four bands.

#### Gauge fallback behavior

- If token usage or model-limit data is unavailable, the gauge MUST remain silent.
- Missing gauge capability degrades parity, but prune and retrieve may still operate if their required capabilities exist.

## Protected Context Contract

By default, the model MUST be guided to keep:

- system and developer operational rules
- the overarching session goal
- unresolved task instructions
- unmet acceptance criteria
- active validation or fix-loop context

Prune selection guidance MUST tell the model to prefer older completed contiguous blocks first and to avoid exposing its internal ranking before it executes a prune.

Protected anchors may be pruned only when an implementation intentionally supports the drift policy equivalent to the OpenCode guidance and the model is instructed accordingly.

## Pattern Matching Contract

Pattern-based boundary resolution is part of the behavioral contract.

- Matching MUST operate on message text and stable representations of every completed tool-call's name, input, and output. The host's text-extraction layer feeding the resolver MUST include all three for any searchable message that carries tool-call structure. Pattern resolution that cannot reach tool-call name, input, or output is a spec violation regardless of whether the omission is by oversight, performance optimization, or content-shape coupling.
- Synthetic transform-added content that exists only to support rendering SHOULD generally be excluded from matching.
- Ambiguous pattern matches MUST fail deterministically.
- On ambiguous pattern matches, before returning the deterministic failure, the implementation MUST exclude from the candidate set any message whose canonical content is a prior `context-bonsai-prune` tool-use wrapper. If exactly one non-wrapper candidate remains, that is the resolved boundary; otherwise the failure is returned. Without this filter, retry sequences after a first-attempt ambiguity error self-poison — the failed call's echoed `from_pattern` / `to_pattern` / `summary` text matches the retry pattern alongside the real target.
- The implementation MAY use host-specific tie-break behavior if it is deterministic and documented.

## Runtime Capability Matrix

Implementations vary in how much host support they have. The spec separates required behavioral capabilities from host-specific delivery mechanisms.

### Core capabilities

- load transcript messages or equivalent session context units
- persist archive state
- rewrite the model-visible transcript
- clear archive state for retrieval

### Parity-complete capabilities

- inject system guidance
- observe token usage and usable model budget
- inject gauge text in-band on a cadence

### Failure semantics

- If a core capability is missing, prune or retrieve MUST fail closed with explicit deterministic compatibility errors.
- If only gauge-related capabilities are missing, prune and retrieve MAY still operate, but the implementation should classify itself as partial parity rather than full parity.

## Host Integration Patterns

This spec intentionally permits multiple integration patterns.

Examples:

- first-party plugin or extension hooks
- minimal host patches plus plugin
- runtime bundle patching
- MCP-backed tool transport when direct tool registration is blocked by provider policy
- hybrid approaches

These are implementation choices, not product-level behavior.
They are also ordered by preference: use the least invasive option that can still satisfy the full behavioral contract.

## Policy and Safety Constraints

An implementation MUST document the policy envelope of its host and provider setup.

- If direct tool registration or transcript mutation triggers provider policy problems, the implementation MUST choose a policy-safe transport.
- Policy workarounds are acceptable if the model-visible contract remains intact.
- Required patch or hook discovery MUST fail closed when the host runtime changes and the insertion point can no longer be identified reliably.
- Unsupported runtime states MUST not silently no-op when the model believes pruning succeeded.

## Operator Documentation Contract

Every Context Bonsai port MUST ship operator-facing documentation that lets a user from the User Gamut install, verify, audit, and uninstall the port on a clean machine. Ports MAY choose their own document structure; the categories below are content requirements, not section-name requirements.

The documentation MUST cover:

- **Prerequisites**: host agent version, runtime/toolchain versions, OS support matrix, and any accounts or credentials the user must already have.
- **Install commands**: concrete copy-paste commands for each platform the port supports, sufficient for a user who does not already know `git clone` / `npm install` / equivalents to follow them step-by-step.
- **Post-install verification**: a positive check the user can run that confirms bonsai is wired into the host (for example, a smoke prompt plus the expected response shape, or a tool-listing command that should show `context-bonsai-prune` and `context-bonsai-retrieve`).
- **Security disclosure**: what data the extension reads from the host transcript or session store, where archive state persists on disk, what is transmitted to the LLM provider (placeholder summary and index terms YES; archived original content NO), and any network egress the port initiates separately from the host agent.
- **Uninstall**: a procedure that returns the host to its pre-install state, including removal of any persisted archive state created by the port.

## Invariants

- Archive and retrieve operations are model-visible all-or-nothing.
- A placeholder always refers to exactly one stored contiguous range.
- Retrieval removes the placeholder effect for that range.
- A failed prune or retrieve leaves the transcript unchanged.
- The model never needs hidden implementation details to use the tools.
- The model should be able to reason from the placeholder alone about whether retrieval is worth doing.

## Non-Goals

- Internal source parity with OpenCode
- A universal storage schema shared byte-for-byte across agents
- Identical message-id mechanics across hosts
- Replacing the host agent's built-in compaction system
- Guaranteeing recovery when the host itself permanently deletes session history
- Standardizing one specific policy workaround such as MCP for all hosts

## Minimum Validation Scenarios

Every agent implementation plan derived from this spec SHOULD include at least these scenarios:

1. Contiguous prune success
2. Ambiguous or unresolved boundary rejection
3. Retrieve by anchor success
4. Gauge cadence and severity behavior
5. Compatibility error behavior when required primitives are missing
6. Persistence across session resume or reload, if the host supports persistence
7. Same-step prune/retrieve guard, if implemented
8. Secret or sensitive-content prune oracle to confirm post-prune recall is not available from active context alone

## Evidence Expectations

Validation should favor model-visible evidence over internal implementation evidence.

Strong evidence includes:

- tool invocations and tool results
- exported or captured transcript showing placeholders or restored ranges
- direct final-model responses after prune or retrieve
- session-file or transcript-store inspection when that is the authoritative persisted source
- runtime logs only when they support, not replace, transcript evidence

## Planning Checklist For A New Agent Port

Before writing an implementation plan, identify:

- the host primitive used to read transcript state
- the host primitive used to persist archive state
- the host primitive used to transform model-visible context
- the host primitive used to inject system guidance
- the source of token-usage and model-limit information
- whether direct tool registration is allowed by the provider and host policy
- how session reload or resume works
- whether message ids are stable, synthetic, absent, or branch-relative
- what fail-closed path will be used if a required hook or patch point disappears
- which required bonsai capabilities can live entirely plugin-side or MCP-side, and which cannot
- the smallest upstream or host-core seam that would be needed if plugin-side delivery proves insufficient

## Suggested Output Artifacts For Per-Agent Plans

Each concrete implementation plan should derive from this spec and normally produce:

- a runtime architecture doc
- a tool-contract doc
- a parity scenario doc
- an e2e validation protocol
- an implementation roadmap with explicit capability mapping and failure semantics
- an operator install/usage doc satisfying the Operator Documentation Contract
