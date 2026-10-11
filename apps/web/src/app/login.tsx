import { loginSchema } from '@fittrack/shared';
import { AuthForm, fieldErrorsFrom } from '../components/AuthForm';
import { useCompleteSignIn } from '../components/useSignIn';
import { useLoginMutation } from '../store/api';

export default function Login() {
  const [login] = useLoginMutation();
  const complete = useCompleteSignIn();
  return (
    <AuthForm
      title="Sign in"
      submitLabel="Sign in"
      fields={[
        { name: 'email', label: 'Email', autoComplete: 'email', keyboardType: 'email-address' },
        { name: 'password', label: 'Password', secure: true, autoComplete: 'password' },
      ]}
      alternate={{ prompt: 'New to FitTrack?', label: 'Create an account', href: '/signup' }}
      onSubmit={async (values) => {
        const parsed = loginSchema.safeParse(values);
        if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
        const result = await login(parsed.data);
        if ('error' in result) return { error: result.error };
        complete(result.data);
      }}
    />
  );
}
