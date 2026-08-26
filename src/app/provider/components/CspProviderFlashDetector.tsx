import { useEffect, useRef, type RefObject } from "react";
import { useLocation } from "react-router-dom";

const NEEDLES = [
  "Provider Setup",
  "Complete your provider setup",
  "Provider onboarding",
  "Getting started",
] as const;

function findNeedleInTree(root: Element): { needle: string; el: Element } | null {
  const stack: Element[] = [root];
  while (stack.length) {
    const el = stack.pop()!;
    const t = el.textContent ?? "";
    for (const needle of NEEDLES) {
      if (t.includes(needle)) return { needle, el };
    }
    for (const c of Array.from(el.children)) stack.push(c);
  }
  return null;
}

type Props = {
  rootRef: RefObject<HTMLElement | null>;
};

/**
 * DEV-only: MutationObserver for onboarding/setup copy under the provider shell.
 * Set `VITE_CSP_FLASH_DETECTOR=0` to disable.
 */
export function CspProviderFlashDetector({ rootRef }: Props) {
  const location = useLocation();
  const pathRef = useRef(location.pathname);

  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (import.meta.env.VITE_CSP_FLASH_DETECTOR === "0") return;

    const root = rootRef.current;
    if (!root) return;

    const report = (needle: string, el: Element) => {
      const html = el.outerHTML.slice(0, 280);
      console.warn("[provider-flash-detector] matched text", {
        matchedText: needle,
        pathname: pathRef.current,
        className: el.className,
        outerHTMLSnippet: html,
        timestamp: Date.now(),
      });
    };

    const scanNode = (node: Node) => {
      const roots: Element[] = [];
      if (node.nodeType === Node.ELEMENT_NODE) roots.push(node as Element);
      if (node instanceof DocumentFragment) {
        node.childNodes.forEach((c) => {
          if (c.nodeType === Node.ELEMENT_NODE) roots.push(c as Element);
        });
      }
      for (const r of roots) {
        const hit = findNeedleInTree(r);
        if (hit) report(hit.needle, hit.el);
      }
    };

    scanNode(root);

    const obs = new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => scanNode(n));
      }
    });

    obs.observe(root, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [rootRef, location.pathname]);

  return null;
}
