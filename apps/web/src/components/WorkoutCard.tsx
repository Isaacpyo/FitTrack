import Ionicons from '@expo/vector-icons/Ionicons';
import { exerciseName, toDateKey, workoutSetCount, workoutVolume, type RecordEvent, type Workout } from '@fittrack/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDuration, formatVolume, relativeDay } from '../lib/format';
import { colors, radius, space } from '../theme';
import { Badge, Body, Row, styles as ui } from './ui';

/** Tappable workout summary used in History and on the dashboard. */
export function WorkoutCard({
  workout,
  today,
  records = [],
  pending,
}: {
  workout: Workout;
  today: string;
  records?: RecordEvent[];
  pending?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const names = workout.exercises.map((e) => exerciseName(e.exerciseId));
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
  const day = relativeDay(toDateKey(workout.startedAt), today);
  const duration = formatDuration(workout.durationMin);

  return (
    <Pressable
      onPress={() => router.push(`/workout/${workout.id}`)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}, ${day}. ${shown}.${records.length ? ` ${records.length} personal records.` : ''}${pending ? ' Not synced yet.' : ''}`}
      style={({ pressed }) => [ui.card, styles.card, focused && ui.focusRing, pressed && { opacity: 0.85 }]}
      testID={`workout-card-${workout.id}`}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={styles.name} numberOfLines={1}>
          {workout.name}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Row>
      <Body muted style={{ fontSize: 14 }}>
        {[day, duration, `${workoutSetCount(workout)} sets`, formatVolume(workoutVolume(workout))].filter(Boolean).join(' · ')}
      </Body>
      <Body style={{ fontSize: 14 }} numberOfLines={1}>
        {shown}
      </Body>
      {records.length || pending ? (
        <View style={styles.badges}>
          {records.length ? <Badge icon="trophy" label={`${records.length} PR${records.length > 1 ? 's' : ''}`} /> : null}
          {pending ? <Badge tone="warning" icon="cloud-upload-outline" label="Not synced yet" /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 6, borderRadius: radius.lg },
  name: { color: colors.text, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  badges: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: 2 },
});
