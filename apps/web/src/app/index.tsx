import { Redirect } from 'expo-router';
import { useAppSelector } from '../store/hooks';
import { selectIsSignedIn } from '../store/selectors';

export default function Index() {
  const signedIn = useAppSelector(selectIsSignedIn);
  return <Redirect href={signedIn ? '/today' : '/welcome'} />;
}
