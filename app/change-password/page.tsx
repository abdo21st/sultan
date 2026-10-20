import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ChangePasswordForm from './password-form';

export default async function ChangePasswordPage() {
    const session = await auth();
    if (!session?.user) redirect('/login');
    if (!session.user.mustChangePassword) redirect('/');
    return <ChangePasswordForm />;
}
