import { signupSchema } from '@fittrack/shared';
import { AuthForm, fieldErrorsFrom } from '../components/AuthForm';
import { useCompleteSignIn } from '../components/useSignIn';
import { useSignupMutation } from '../store/api';

export default function Signup() {
  const [signup] = useSignupMutation();
  const complete = useCompleteSignIn();
  return (
    <AuthForm
      title="Create account"
      submitLabel="Create account"
      fields={[
        { name: 'displayName', label: 'Name', autoComplete: 'name' },
        { name: 'email', label: 'Email', autoComplete: 'email', keyboardType: 'email-address' },
        {
          name: 'password',
          label: 'Password',
          secure: true,
          autoComplete: 'new-password',
          hint: 'At least 8 characters',
        },
      ]}
      alternate={{ prompt: 'Already have an account?', label: 'Sign in', href: '/login' }}
      onSubmit={async (values) => {
        const parsed = signupSchema.safeParse(values);
        if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };
        const result = await signup(parsed.data);
        if ('error' in result) return { error: result.error };
        complete(result.data);
      }}
    />
  );
}
