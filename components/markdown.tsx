import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small Markdown renderer for the subset our own system prompt
 * asks the model to produce: h2/h3, bullet and numbered lists, paragraphs,
 * fenced code, `inline code` and **bold**.
 *
 * It builds React elements rather than HTML strings, so there is no
 * dangerouslySetInnerHTML and no sanitiser to get wrong. Anything it does not
 * recognise renders as plain text.
 */

type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; code: string }
  | { kind: "paragraph"; text: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`/g;

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
    if (list !== null) {
      blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
  };

  for (const line of markdown.split("\n")) {
    if (code !== null) {
      if (line.trimStart().startsWith("```")) {
        blocks.push({ kind: "code", code: code.join("\n") });
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }

    if (line.trimStart().startsWith("```")) {
      flush();
      code = [];
      continue;
    }

    if (line.trim() === "") {
      flush();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        kind: "heading",
        level: heading[1].length <= 2 ? 2 : 3,
        text: heading[2].trim(),
      });
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);

    if (bullet || ordered) {
      const isOrdered = ordered !== null;
      const item = (bullet?.[1] ?? ordered?.[1] ?? "").trim();

      if (paragraph.length > 0) {
        blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
        paragraph = [];
      }
      if (list !== null && list.ordered !== isOrdered) {
        blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
        list = null;
      }
      if (list === null) {
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(item);
      continue;
    }

    // A non-empty line under a list item is a wrapped continuation of it.
    if (list !== null && list.items.length > 0) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }

    paragraph.push(line.trim());
  }

  if (code !== null) {
    blocks.push({ kind: "code", code: code.join("\n") });
  }
  flush();

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  INLINE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-ink">
          {match[1]}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={key++}
          dir="ltr"
          className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[0.85em] text-accent-bright"
        >
          {match[2]}
        </code>,
      );
    }
    cursor = INLINE.lastIndex;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

export function Markdown({ content }: { content: string }) {
  return (
    <div className="text-[0.95rem] leading-relaxed text-muted">
      {parseBlocks(content).map((block, index) => (
        <Fragment key={index}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

function renderBlock(block: Block): ReactNode {
  switch (block.kind) {
    case "heading":
      return block.level === 2 ? (
        <h2 className="mt-8 mb-3 border-b border-line pb-2 text-lg font-semibold tracking-tight text-ink first:mt-0">
          {renderInline(block.text)}
        </h2>
      ) : (
        <h3 className="mt-6 mb-2 text-sm font-semibold tracking-tight text-accent-bright">
          {renderInline(block.text)}
        </h3>
      );

    case "list": {
      const items = block.items.map((item, index) => (
        <li key={index} className="ps-1.5 marker:text-line-strong">
          {renderInline(item)}
        </li>
      ));
      return block.ordered ? (
        <ol className="my-3 list-decimal space-y-1.5 ps-5">{items}</ol>
      ) : (
        <ul className="my-3 list-disc space-y-1.5 ps-5">{items}</ul>
      );
    }

    case "code":
      return (
        <pre
          dir="ltr"
          className="my-4 overflow-x-auto rounded-lg border border-line bg-canvas p-4 text-left"
        >
          <code className="font-mono text-xs text-ink">{block.code}</code>
        </pre>
      );

    case "paragraph":
      return <p className="my-3">{renderInline(block.text)}</p>;
  }
}
