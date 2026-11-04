import { useEffect, useState } from "react";
import { EFFECTS } from "../effects";
import { EffectCard } from "./EffectCard";
import type { EffectState } from "../effects/types";
import {
  deleteKeyframeEffect,
  loadKeyframeEffects,
  type KeyframeEffectDef,
} from "../effects/keyframe";

type Props = {
  state: EffectState;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (effect: KeyframeEffectDef) => void;
  refreshKey: number;
};

export function EffectPicker({
  state,
  onSelect,
  onCreate,
  onEdit,
  refreshKey,
}: Props) {
  const [keyframes, setKeyframes] = useState<KeyframeEffectDef[]>([]);

  useEffect(() => {
    setKeyframes(loadKeyframeEffects());
  }, [refreshKey]);

  const deleteEffect = (id: string) => {
    if (!confirm("Delete this effect?")) return;
    deleteKeyframeEffect(id);
    setKeyframes(loadKeyframeEffects());
  };

  const totalCount = EFFECTS.length + keyframes.length;

  return (
    <aside className="flex flex-col h-full border-r border-ink-500 bg-ink-800/40 backdrop-blur-sm">
      {/* header */}
      <div className="px-4 pt-4 pb-3 border-b border-ink-500/70">
        <div className="flex items-baseline justify-between">
          <span className="font-display font-bold tracking-tight text-ink-50 text-sm">
            EFFECTS
          </span>
          <span className="caps text-ink-300">{totalCount}</span>
        </div>
        <p className="caps text-ink-300 mt-1">presets · custom</p>
      </div>

      {/* + NEW button — pinned at the top */}
      <button
        onClick={onCreate}
        className="relative mx-3 mt-3 px-3 py-3 border border-amber-500/30 bg-amber-500/[0.04] hover:bg-amber-500/[0.10] hover:border-amber-500/60 transition-all duration-200 group flex-shrink-0"
      >
        <div className="flex items-center justify-between">
          <span className="font-display font-bold tracking-tight text-amber-500 text-sm">
            + NEW EFFECT
          </span>
          <span className="caps text-ink-300 group-hover:text-amber-500/70 transition">
            keyframe
          </span>
        </div>
        <p className="caps text-ink-300 mt-1 text-left">
          paint your own animation
        </p>
        <span
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            boxShadow:
              "0 0 24px 0 rgba(255,180,84,0.18), inset 0 0 0 1px rgba(255,180,84,0.4)",
          }}
        />
      </button>

      {/* scroll list */}
      <div
        className="flex-1 overflow-y-auto scroll-y mt-3 divide-y divide-ink-500/40"
        style={{ scrollBehavior: "smooth" }}
      >
        {keyframes.length > 0 && (
          <div className="px-4 pt-2 pb-1">
            <span className="caps text-ink-300">user · keyframe</span>
          </div>
        )}
        {keyframes.map((e) => (
          <div key={e.id} className="effect-row">
            <EffectCard
              id={e.id}
              label={e.label}
              blurb={e.blurb}
              state={state}
              active={state.mode === e.id}
              custom
              onSelect={() => onSelect(e.id)}
              onEdit={() => onEdit(e)}
              onDelete={() => deleteEffect(e.id)}
            />
          </div>
        ))}

        {keyframes.length > 0 && (
          <div className="px-4 pt-3 pb-1">
            <span className="caps text-ink-300">presets</span>
          </div>
        )}
        {EFFECTS.map((e) => (
          <div key={e.id} className="effect-row">
            <EffectCard
              id={e.id}
              label={e.label}
              blurb={e.blurb}
              state={state}
              active={state.mode === e.id}
              onSelect={() => onSelect(e.id)}
            />
          </div>
        ))}
      </div>
    </aside>
  );
}
