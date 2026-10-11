import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { describeApiError } from '../store/api';
import { colors, space } from '../theme';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';
import { useDemoSignIn } from './useSignIn';
import { Banner, Body, Button, Card, TextField } from './ui';

export interface AuthField {
  name: string;
  label: string;
  secure?: boolean;
  autoComplete?: 'email' | 'password' | 'new-password' | 'name';
  keyboardType?: 'email-address' | 'default';
  hint?: string;
}

interface AuthFormProps {
  title: string;
  submitLabel: string;
  fields: AuthField[];
  /** Validates locally and calls the API; returns field errors or a form-level error. */
  onSubmit: (values: Record<string, string>) => Promise<{ fieldErrors?: Record<string, string>; error?: unknown } | void>;
  alternate: { prompt: string; label: string; href: '/login' | '/signup' };
}

export function AuthForm({ title, submitLabel, fields, onSubmit, alternate }: AuthFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, ''])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const demo = useDemoSignIn();

  const submit = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await onSubmit(values);
      setErrors(result?.fieldErrors ?? {});
      if (result?.error) setFormError(describeApiError(result.error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen width="form">
      <ScreenHeader title={title} fallback="/welcome" />
      <Card style={{ gap: space.lg }}>
        {formError ? (
          <Banner tone="danger" icon="alert-circle-outline">
            <Body>{formError}</Body>
          </Banner>
        ) : null}
        {fields.map((f, i) => (
          <TextField
            key={f.name}
            label={f.label}
            value={values[f.name]}
            onChangeText={(text) => setValues((v) => ({ ...v, [f.name]: text }))}
            error={errors[f.name]}
            hint={f.hint}
            secureTextEntry={f.secure}
            autoComplete={f.autoComplete}
            keyboardType={f.keyboardType}
            autoCapitalize={f.name === 'displayName' ? 'words' : 'none'}
            autoCorrect={false}
            returnKeyType={i === fields.length - 1 ? 'go' : 'next'}
            onSubmitEditing={i === fields.length - 1 ? submit : undefined}
          />
        ))}
        <Button label={submitLabel} onPress={submit} loading={submitting} />
      </Card>
      <View style={{ gap: space.sm, alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted }}>{alternate.prompt}</Text>
        <Button variant="ghost" label={alternate.label} onPress={() => router.replace(alternate.href)} />
        <Button variant="ghost" icon="play" label="Or try the demo" onPress={demo.start} loading={demo.isLoading} />
        {demo.error ? <Body style={{ color: colors.danger }}>{describeApiError(demo.error)}</Body> : null}
      </View>
    </Screen>
  );
}

/** Map Zod issues to { field: firstMessage }. */
export function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}
