import { redirect } from 'next/navigation';
// Legacy unscoped editors must not operate on whichever venue was last cached.
export default function LegacyEditor(){redirect('/admin');}
