import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BorderBeam } from 'border-beam';

// Move original nodes so booking handlers and dialog focus stay attached.
function BeamSurface({ node, dialog, radius, className }) {
  const content = useRef(null);
  const [active, setActive] = useState(false);

  useLayoutEffect(() => {
    content.current.append(node);
  }, [node]);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setActive(
      !motion.matches && !document.hidden && (!dialog || dialog.open)
    );
    const observer = new MutationObserver(update);
    if (dialog) observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    motion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [dialog]);

  return (
    <BorderBeam size="md" colorVariant="colorful" strength={0.7}
      theme="dark" active={active} borderRadius={radius} className={className}>
      <div className={`${className}-content`} ref={content} />
    </BorderBeam>
  );
}

const form = document.querySelector('#hero-chat');
if (form) {
  const mount = document.createElement('div');
  mount.className = 'hero-beam-host';
  form.before(mount);
  createRoot(mount).render(<BeamSurface node={form} radius={40} className="hero-beam" />);
}

const dialog = document.querySelector('#chat');
if (dialog) {
  const panel = document.createElement('div');
  panel.className = 'chat-panel';
  panel.append(...dialog.childNodes);
  const mount = document.createElement('div');
  mount.className = 'chat-beam-host';
  dialog.append(mount);
  createRoot(mount).render(
    <BeamSurface node={panel} dialog={dialog} radius={28} className="chat-beam" />
  );
}
