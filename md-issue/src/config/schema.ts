import Type from 'typebox';

const StringMap = Type.Record(Type.String(), Type.String());

const JiraProvider = Type.Object({
  name: Type.String({ minLength: 1 }),
  type: Type.Literal('jira'),
  host: Type.String({ minLength: 1 }),
  'default-project': Type.String({ minLength: 1 }),
  'default-issue-type': Type.Optional(Type.String()),
  'epic-issue-type': Type.Optional(Type.String()),
  'auth-cmd': Type.String({ minLength: 1 }),
  'custom-fields': Type.Optional(Type.Record(Type.String(), Type.Boolean())),
});

const GitHubProvider = Type.Object({
  name: Type.String({ minLength: 1 }),
  type: Type.Literal('github'),
  owner: Type.String({ minLength: 1 }),
  repo: Type.String({ minLength: 1 }),
  'default-project': Type.Optional(Type.String()),
  'auth-cmd': Type.String({ minLength: 1 }),
  'custom-fields': Type.Optional(Type.Record(Type.String(), Type.Boolean())),
});

export const ProviderSchema = Type.Union([JiraProvider, GitHubProvider]);

export const MappingSchema = Type.Object({
  glob: Type.String({ minLength: 1 }),
  provider: Type.String({ minLength: 1 }),
});

export const ArchiveSchema = Type.Object({
  dir: Type.String({ minLength: 1 }),
});

export const ConfigSchema = Type.Object({
  status: Type.Optional(StringMap),
  priority: Type.Optional(StringMap),
  'unsafe-chars': Type.Optional(StringMap),
  archive: Type.Optional(ArchiveSchema),
  providers: Type.Array(ProviderSchema, { minItems: 1 }),
  mappings: Type.Array(MappingSchema, { minItems: 1 }),
});

export type Config = Type.Static<typeof ConfigSchema>;
export type Provider = Type.Static<typeof ProviderSchema>;
export type Mapping = Type.Static<typeof MappingSchema>;
