import { useState } from 'react';
import { Sun, Moon, Monitor, Palette, Check } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { ACCENTS, type AccentKey } from '@/lib/accents';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export function ThemeMenu() {
  const { mode, resolved, accent, setMode, setAccent } = useTheme();
  const [open, setOpen] = useState(false);

  const modes = [
    { v: 'light', icon: Sun, label: 'Light' },
    { v: 'dark', icon: Moon, label: 'Dark' },
    { v: 'auto', icon: Monitor, label: 'Auto' },
  ] as const;

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label="Theme settings">
        {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass absolute right-0 z-50 mt-2 w-64 space-y-4 p-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-500">Appearance</p>
              <div className="grid grid-cols-3 gap-2">
                {modes.map((m) => (
                  <button
                    key={m.v}
                    onClick={() => setMode(m.v)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition',
                      mode === m.v
                        ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                        : 'border-white/10 text-slate-500 hover:bg-white/5',
                    )}
                  >
                    <m.icon size={16} /> {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Palette size={13} /> Accent color
              </p>
              <div className="flex flex-wrap gap-2.5">
                {(Object.keys(ACCENTS) as AccentKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setAccent(key)}
                    aria-label={ACCENTS[key].label}
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-transparent transition',
                      accent === key ? 'ring-white/60 scale-110' : 'ring-transparent hover:scale-110',
                    )}
                    style={{ backgroundColor: ACCENTS[key].swatch }}
                  >
                    {accent === key && <Check size={15} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
