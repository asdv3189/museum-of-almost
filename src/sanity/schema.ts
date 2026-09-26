import { defineArrayMember, defineField, defineType } from "sanity";

const textField = (
  name: string,
  title: string,
  max: number,
  multiline = false,
) =>
  defineField({
    name,
    title,
    type: multiline ? "text" : "string",
    validation: (rule) => rule.required().max(max),
  });

const branch = defineType({
  name: "almostBranch",
  title: "A possible consequence",
  type: "object",
  fields: [
    textField("id", "Stable branch ID", 61),
    textField("label", "Visitor choice", 100),
    textField("consequence", "What changes", 500, true),
    defineField({
      name: "target",
      title: "Next exhibit",
      type: "reference",
      to: [{ type: "almostExhibit" }],
      weak: true,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: { select: { title: "label", subtitle: "target.title" } },
});

const contentFields = [
  textField("title", "Title", 80),
  textField("subtitle", "Short description", 150),
  defineField({
    name: "category",
    type: "string",
    options: { list: ["Little rituals", "Shared spaces", "Slower living"] },
    validation: (rule) => rule.required(),
  }),
  textField("year", "Imagined date (fiction)", 30),
  textField("premise", "The imagined invention", 1200, true),
  textField("almost", "Why it stayed almost", 1000, true),
  textField("question", "Branching question", 150),
  defineField({
    name: "color",
    type: "string",
    validation: (rule) => rule.required().regex(/^#[0-9a-f]{6}$/i),
  }),
  defineField({
    name: "artifact",
    type: "string",
    options: {
      list: ["umbrella", "clock", "bench", "lamp", "radio", "garden"],
    },
    validation: (rule) => rule.required(),
  }),
  defineField({
    name: "branches",
    type: "array",
    of: [defineArrayMember({ type: "almostBranch" })],
    validation: (rule) => rule.max(3),
  }),
];

const content = defineType({
  name: "exhibitContent",
  title: "Exhibit content",
  type: "object",
  fields: contentFields,
});
const snapshot = defineType({
  name: "exhibitSnapshot",
  title: "Revision snapshot",
  type: "object",
  fields: [
    defineField({
      name: "revision",
      type: "number",
      validation: (rule) => rule.required().integer().min(1),
    }),
    defineField({
      name: "content",
      type: "exhibitContent",
      validation: (rule) => rule.required(),
    }),
  ],
});

const exhibitWorkspace = defineType({
  name: "exhibitWorkspace",
  type: "object",
  fields: [
    textField("id", "Exhibit ID", 61),
    textField("number", "Collection number", 4),
    defineField({
      name: "draft",
      type: "exhibitSnapshot",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "published", type: "exhibitSnapshot" }),
    defineField({
      name: "review",
      type: "object",
      fields: [
        defineField({ name: "revision", type: "number" }),
        defineField({ name: "requestedAt", type: "datetime" }),
      ],
    }),
    defineField({
      name: "approval",
      type: "object",
      fields: [
        defineField({ name: "revision", type: "number" }),
        defineField({ name: "contentFingerprint", type: "text" }),
        defineField({ name: "approvedAt", type: "datetime" }),
      ],
    }),
  ],
  preview: { select: { title: "draft.content.title", subtitle: "id" } },
});

const audit = defineType({
  name: "auditEvent",
  type: "object",
  fields: [
    textField("id", "Event ID", 100),
    textField("action", "Action", 30),
    textField("exhibitId", "Exhibit", 61),
    defineField({ name: "revision", type: "number" }),
    defineField({ name: "timestamp", type: "datetime" }),
    textField("actor", "Workflow role", 30),
    textField("detail", "Transition detail", 500, true),
  ],
  preview: { select: { title: "action", subtitle: "exhibitId" } },
});

export const schemaTypes = [
  branch,
  content,
  snapshot,
  exhibitWorkspace,
  audit,
  defineType({
    name: "almostExhibit",
    title: "Published exhibit",
    type: "document",
    readOnly: true,
    description:
      "Published projections are controlled by the curator workflow. Direct API writers with sufficient rights can bypass the app; use a dedicated dataset and limited tokens.",
    fields: [
      textField("exhibitId", "Exhibit ID", 61),
      textField("number", "Collection number", 4),
      defineField({ name: "revision", type: "number" }),
      defineField({ name: "fiction", type: "boolean", initialValue: true }),
      ...contentFields,
    ],
    preview: { select: { title: "title", subtitle: "category" } },
  }),
  defineType({
    name: "almostWorkspace",
    title: "Museum workflow",
    type: "document",
    readOnly: true,
    description:
      "Drafts, review, approval, and audit commit together. Use the custom curator room to enforce transitions.",
    fields: [
      defineField({ name: "schemaVersion", type: "number" }),
      defineField({ name: "version", type: "number" }),
      defineField({
        name: "exhibits",
        type: "array",
        of: [defineArrayMember({ type: "exhibitWorkspace" })],
      }),
      defineField({
        name: "audit",
        type: "array",
        of: [defineArrayMember({ type: "auditEvent" })],
      }),
    ],
    preview: {
      prepare: () => ({
        title: "Museum of Almost",
        subtitle: "Reviewable content workflow",
      }),
    },
  }),
];
