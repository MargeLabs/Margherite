'use client';

// Moteur de rendu des maquettes Design (« .dc.html ») : le gabarit (sc-if, sc-for, {{ chemin.pointé }}) est lu
// tel quel et rendu par React, avec les mêmes règles que le moteur d'origine, pour que le DOM, donc l'aspect, soient identiques.
// Règles reprises : un trou de texte devient <span class="sc-interp">, un texte fait uniquement de retours à la ligne est ignoré,
// un sc-for parcourt une liste avec $index, un attribut « {{ x }} » seul garde la valeur brute (fonction, booléen…).

import React from 'react';

export type Scope = { [key: string]: unknown };
type Render = (scope: Scope, key: number) => React.ReactNode;
type Getter = (scope: Scope) => unknown;

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[dc-engine] ${message}`);
}

// ---------------------------------------------------------------- expressions : chemins pointés, !, littéraux
function lookup(scope: Scope, path: string): unknown {
  let cur: unknown = scope;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function evalExpr(scope: Scope, raw: string): unknown {
  const e = raw.trim();
  if (!e) return undefined;
  if (e.startsWith('!')) return !evalExpr(scope, e.slice(1));
  if (e === 'true') return true;
  if (e === 'false') return false;
  if (e === 'null') return null;
  if (e === 'undefined') return undefined;
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  if (e.length >= 2 && (e[0] === '"' || e[0] === "'") && e[e.length - 1] === e[0]) return e.slice(1, -1);
  return lookup(scope, e);
}

function compileAttr(raw: string): Getter {
  const single = raw.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
  if (single) {
    const expr = single[1] ?? '';
    return (s) => evalExpr(s, expr);
  }
  if (raw.includes('{{')) {
    const parts = raw.split(/\{\{([\s\S]+?)\}\}/g);
    return (s) => parts.map((p, i) => (i & 1 ? String(evalExpr(s, p) ?? '') : p)).join('');
  }
  return () => raw;
}

// ---------------------------------------------------------------- attributs HTML / SVG → props React
const ATTR_MAP: Record<string, string> = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onsubmit: 'onSubmit',
  readonly: 'readOnly', maxlength: 'maxLength', inputmode: 'inputMode', autocomplete: 'autoComplete', autofocus: 'autoFocus',
  colspan: 'colSpan', rowspan: 'rowSpan', contenteditable: 'contentEditable', spellcheck: 'spellCheck',
};

function reactAttr(name: string): string {
  const mapped = ATTR_MAP[name];
  if (mapped) return mapped;
  if (name.startsWith('aria-') || name.startsWith('data-')) return name;
  if (name.includes(':')) return name.replace(/:([a-z])/g, (_m, c: string) => c.toUpperCase());
  return name.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

function splitDeclarations(css: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of css) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ';' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function parseStyle(css: string): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const decl of splitDeclarations(css)) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    if (prop.startsWith('--')) style[prop] = value;
    else {
      const camel = prop.replace(/^-ms-/, 'ms-').replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
      style[camel.startsWith('-') ? camel.slice(1) : camel] = value;
    }
  }
  return style as React.CSSProperties;
}

// ---------------------------------------------------------------- compilation du gabarit
function compileText(node: Text): Render | null {
  const text = node.nodeValue ?? '';
  if (!text.includes('{{')) return !text.trim() && !text.includes(' ') ? null : () => text;
  const parts = text.split(/\{\{([\s\S]+?)\}\}/g);
  return (scope, key) =>
    React.createElement(
      React.Fragment,
      { key },
      ...parts.map((p, i) => {
        if (!(i & 1)) return p;
        const value = evalExpr(scope, p);
        if (value === undefined) {
          warnOnce(`« ${p.trim()} » n’a pas de valeur`);
          return null;
        }
        if (React.isValidElement(value) || Array.isArray(value)) return React.createElement(React.Fragment, { key: i }, value);
        if (value === null || typeof value === 'boolean') return null;
        return React.createElement('span', { key: i, className: 'sc-interp' }, String(value));
      }),
    );
}

function compileFor(el: Element): Render {
  const list = compileAttr(el.getAttribute('list') ?? '');
  const as = el.getAttribute('as') ?? 'item';
  const kids = compileNodes(el.childNodes);
  return (scope, key) => {
    let items = list(scope);
    if (!Array.isArray(items)) {
      if (items !== null && items !== undefined) warnOnce(`sc-for list="${el.getAttribute('list') ?? ''}" n’est pas une liste`);
      items = [];
    }
    return React.createElement(
      React.Fragment,
      { key },
      (items as unknown[]).map((item, idx) => {
        const inner: Scope = { ...scope, [as]: item, $index: idx };
        return React.createElement(React.Fragment, { key: idx }, kids.map((k, i) => k(inner, i)));
      }),
    );
  };
}

function compileIf(el: Element): Render {
  const test = compileAttr(el.getAttribute('value') ?? '');
  const kids = compileNodes(el.childNodes);
  return (scope, key) => (test(scope) ? React.createElement(React.Fragment, { key }, kids.map((k, i) => k(scope, i))) : null);
}

function compileElement(el: Element): Render {
  const tag = el.localName;
  const getters: Array<[string, Getter]> = [];
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name;
    if (name.startsWith('data-dc-') || name.startsWith('hint-')) continue;
    getters.push([reactAttr(name), compileAttr(attr.value)]);
  }
  const kids = compileNodes(el.childNodes);
  return (scope, key) => {
    const props: Record<string, unknown> = { key };
    for (const [name, get] of getters) {
      let value = get(scope);
      if (name === 'style' && typeof value === 'string') value = parseStyle(value);
      if ((name === 'value' || name === 'checked') && value === undefined) value = name === 'checked' ? false : '';
      props[name] = value;
    }
    return React.createElement(tag, props, ...kids.map((k, i) => k(scope, i)));
  };
}

function compileNodes(nodes: ArrayLike<ChildNode>): Render[] {
  const out: Render[] = [];
  for (const n of Array.from(nodes)) {
    let r: Render | null = null;
    if (n.nodeType === Node.TEXT_NODE) r = compileText(n as Text);
    else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element;
      const t = el.localName;
      r = t === 'sc-for' ? compileFor(el) : t === 'sc-if' ? compileIf(el) : compileElement(el);
    }
    if (r) out.push(r);
  }
  return out;
}

export function compileTemplate(markup: string): (vals: Scope) => React.ReactNode {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup;
  const roots = compileNodes(tpl.content.childNodes);
  return (vals) => roots.map((r, i) => r(vals, i));
}

// ---------------------------------------------------------------- DCLogic : la classe de base des maquettes
export interface LogicHost {
  setLogicState(partial: Scope, cb?: () => void): void;
  forceUpdate(): void;
}

export class DCLogic {
  props: Scope;
  state: Scope = {};
  __host?: LogicHost;
  constructor(props?: Scope) {
    this.props = props ?? {};
  }
  setState(partial: Scope, cb?: () => void): void {
    this.__host?.setLogicState(partial, cb);
  }
  forceUpdate(): void {
    this.__host?.forceUpdate();
  }
  componentDidMount(): void {}
  componentDidUpdate(_prevProps?: Scope): void {}
  componentWillUnmount(): void {}
  renderVals(): Scope {
    return {};
  }
}

export type LogicClass = new (props?: Scope) => DCLogic;

interface HostProps {
  template: string;
  Logic: LogicClass;
  logicProps: Scope;
}

interface HostState {
  ls: Scope;
}

/** Équivalent React du composant d'une maquette : l'état de la logique vit ici, le gabarit est rendu avec ses `renderVals()`. */
export class DcHost extends React.Component<HostProps, HostState> implements LogicHost {
  state: HostState = { ls: {} };
  private logic: DCLogic;
  private render_: (vals: Scope) => React.ReactNode;

  constructor(props: HostProps) {
    super(props);
    this.logic = new props.Logic(props.logicProps);
    this.logic.__host = this;
    this.render_ = compileTemplate(props.template);
  }

  setLogicState(partial: Scope, cb?: () => void): void {
    this.setState((prev) => ({ ls: { ...prev.ls, ...partial } }), cb);
  }

  componentDidMount(): void {
    this.logic.componentDidMount();
  }

  componentDidUpdate(prevProps: HostProps): void {
    this.logic.componentDidUpdate(prevProps.logicProps);
  }

  componentWillUnmount(): void {
    this.logic.componentWillUnmount();
  }

  render(): React.ReactNode {
    this.logic.props = this.props.logicProps;
    this.logic.state = this.state.ls;
    return this.render_(this.logic.renderVals());
  }
}
