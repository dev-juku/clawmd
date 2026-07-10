import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { useEffect, useRef } from "react";

const editable = new Compartment();
const fontSize = new Compartment();
const historyField = new Compartment();
const theme = EditorView.theme({
  "&": {
    height: "100%",
    background: "#fbfbfa",
    color: "#1f2328"
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    overflowX: "hidden"
  },
  ".cm-content": {
    maxWidth: "100%",
    padding: "18px 0"
  },
  ".cm-line": {
    overflowWrap: "anywhere",
    padding: "0 18px",
    wordBreak: "break-word"
  },
  ".cm-gutters": {
    background: "#f3f4f2",
    color: "#8a8f98",
    borderRight: "1px solid #dfe3e6"
  },
  ".cm-activeLine": {
    background: "#eef4ff"
  },
  ".cm-activeLineGutter": {
    background: "#e6edf8"
  }
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: "#0f4f8f", fontWeight: "700" },
  { tag: tags.strong, fontWeight: "700" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.monospace, color: "#8b3a12" },
  { tag: tags.link, color: "#0969da" }
]);

type MarkdownEditorProps = {
  value: string;
  disabled?: boolean;
  fontSizePx: number;
  onChange: (value: string) => void;
  onSelectionChange: (value: string) => void;
};

export default function MarkdownEditor({ value, disabled = false, fontSizePx, onChange, onSelectionChange }: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSelectionChangeRef = useRef(onSelectionChange);

  onChangeRef.current = onChange;
  onSelectionChangeRef.current = onSelectionChange;

  useEffect(() => {
    if (!hostRef.current) return;

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          markdown(),
          EditorView.lineWrapping,
          theme,
          fontSize.of(EditorView.theme({ "&": { fontSize: `${fontSizePx}px` } })),
          syntaxHighlighting(highlightStyle),
          editable.of(EditorView.editable.of(!disabled)),
          historyField.of(history()),
          keymap.of([indentWithTab, ...historyKeymap, ...defaultKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) {
              const ranges = update.state.selection.ranges.filter((range) => !range.empty);
              const selectedText = ranges.map((range) => update.state.sliceDoc(range.from, range.to)).join("\n");
              onSelectionChangeRef.current(selectedText);
            }
          })
        ]
      })
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      // External content (loading/switching files or an on-disk reload): replace
      // the doc and reset undo history so undo can't cross into the previous file.
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
        effects: historyField.reconfigure([])
      });
      view.dispatch({ effects: historyField.reconfigure(history()) });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!disabled)) });
  }, [disabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: fontSize.reconfigure(EditorView.theme({ "&": { fontSize: `${fontSizePx}px` } })) });
  }, [fontSizePx]);

  return <div ref={hostRef} className="editor-host" />;
}
