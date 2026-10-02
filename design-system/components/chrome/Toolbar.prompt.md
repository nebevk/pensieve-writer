Formatting toolbar: the quiet row by default, the grouped "All tools" row when expanded.

```jsx
<Toolbar expanded={open} onToggleExpanded={() => setOpen(!open)} active={["bold"]} />
```

Groups when expanded: History, Text, Format, Paragraph, Insert, Pensieve, Find. Tool ids are passed to onTool.
