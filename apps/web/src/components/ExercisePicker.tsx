import { EXERCISES, MUSCLE_GROUP_LABELS, type MuscleGroup } from '@fittrack/shared';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, maxWidth, radius, space } from '../theme';
import { Chip, IconButton, TextField, Title } from './ui';

const GROUPS = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];

/** Searchable, filterable exercise catalog in a modal. */
export function ExercisePicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (exerciseId: string) => void }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter((e) => (!group || e.muscleGroup === group) && (!q || e.name.toLowerCase().includes(q)));
  }, [query, group]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Title>Add exercise</Title>
            <IconButton icon="close" label="Close exercise picker" onPress={onClose} />
          </View>
          <TextField label="Search exercises" value={query} onChangeText={setQuery} placeholder="e.g. squat" autoCorrect={false} autoFocus />
          <View style={styles.chips}>
            <Chip label="All" selected={group === null} onPress={() => setGroup(null)} />
            {GROUPS.map((g) => (
              <Chip key={g} label={MUSCLE_GROUP_LABELS[g]} selected={group === g} onPress={() => setGroup(g)} />
            ))}
          </View>
          <FlatList
            data={results}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>No exercises match “{query}”.</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.name}`}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceRaised }]}
              >
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {MUSCLE_GROUP_LABELS[item.muscleGroup]} · {item.equipment}
                </Text>
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, width: '100%', maxWidth: maxWidth.form, alignSelf: 'center', padding: space.lg, gap: space.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  item: { paddingVertical: space.md, paddingHorizontal: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border, borderRadius: radius.sm },
  itemName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  itemMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: space.xl },
});
