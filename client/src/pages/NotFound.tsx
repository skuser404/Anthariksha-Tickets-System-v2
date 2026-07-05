import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui';

export default function NotFoundPage() {
  return (
    <div className="app-bg grid min-h-screen place-items-center p-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass max-w-md p-10 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-600/15 text-brand-500">
          <Compass size={30} />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight">404</h1>
        <p className="mt-2 text-lg font-semibold">Page not found</p>
        <p className="mt-1 text-sm text-slate-500">The trail you followed doesn't lead anywhere. Let's get you back to base camp.</p>
        <Link to="/" className="mt-6 inline-block">
          <Button><Home size={16} /> Back to dashboard</Button>
        </Link>
      </motion.div>
    </div>
  );
}
