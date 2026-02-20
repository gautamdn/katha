import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { semantic, textStyles, spacing, radius, colors } from '@/theme';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useProfileUpdate } from '@/hooks/useProfile';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const profileUpdate = useProfileUpdate();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [relationshipLabel, setRelationshipLabel] = useState(
    profile?.relationship_label ?? '',
  );

  const initial = profile?.display_name?.charAt(0) ?? '?';

  function handleSave() {
    profileUpdate.mutate(
      {
        display_name: displayName.trim(),
        bio: bio.trim() || undefined,
        relationship_label: relationshipLabel.trim() || undefined,
      },
      {
        onSuccess: () => setIsEditing(false),
      },
    );
  }

  function handleSignOut() {
    signOut().then(() => router.replace('/'));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          {isEditing ? (
            <View style={styles.editForm}>
              <Input
                label="Display name"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
              <Input
                label="Relationship label"
                placeholder="e.g., Nani, Dada, Grandma"
                value={relationshipLabel}
                onChangeText={setRelationshipLabel}
              />
              <Input
                label="Bio"
                placeholder="Tell your family a little about yourself"
                value={bio}
                onChangeText={setBio}
                multiline
              />
              <View style={styles.editActions}>
                <Button
                  label="Save"
                  onPress={handleSave}
                  loading={profileUpdate.isPending}
                />
                <Button
                  label="Cancel"
                  onPress={() => setIsEditing(false)}
                  variant="link"
                />
              </View>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{profile?.display_name}</Text>
              {profile?.relationship_label && (
                <Text style={styles.relationship}>
                  {profile.relationship_label}
                </Text>
              )}
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  {profile?.role === 'guardian' ? 'Guardian' : 'Writer'}
                </Text>
              </View>
              {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
              <Button
                label="Edit Profile"
                onPress={() => setIsEditing(true)}
                variant="secondary"
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.signOutSection}>
          <Button label="Sign Out" onPress={handleSignOut} variant="link" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: semantic.background,
  },
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[10],
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing[8],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: semantic.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  avatarText: {
    ...textStyles.displayMedium,
    color: semantic.primaryDark,
  },
  profileInfo: {
    alignItems: 'center',
    gap: spacing[2],
    width: '100%',
  },
  name: {
    ...textStyles.h2,
    color: semantic.textPrimary,
  },
  relationship: {
    ...textStyles.body,
    color: semantic.textSecondary,
  },
  roleBadge: {
    backgroundColor: semantic.primaryLight,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    marginBottom: spacing[2],
  },
  roleBadgeText: {
    ...textStyles.caption,
    color: semantic.primaryDark,
  },
  bio: {
    ...textStyles.body,
    color: semantic.textSecondary,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  editForm: {
    width: '100%',
    gap: spacing[4],
  },
  editActions: {
    gap: spacing[2],
  },
  section: {
    marginBottom: spacing[8],
  },
  sectionTitle: {
    ...textStyles.h3,
    color: semantic.textPrimary,
    marginBottom: spacing[3],
  },
  email: {
    ...textStyles.body,
    color: semantic.textSecondary,
  },
  signOutSection: {
    alignItems: 'center',
    paddingTop: spacing[4],
  },
});
