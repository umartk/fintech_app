import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../navigation/types';
import {
  ScreenContainer,
  Text,
  Input,
  Button,
  LoadingSpinner,
  Card,
} from '../components';
import { colors, spacing, typography } from '../theme';
import { useAuthStore } from '../store/authStore';
import { userService, UserProfileDetailed } from '../services';

type Props = NativeStackScreenProps<MainStackParamList, 'Profile'>;

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, setUser } = useAuthStore();
  const [profile, setProfile] = useState<UserProfileDetailed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    dateOfBirth: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const profileData = await userService.getProfile();
      setProfile(profileData);
      
      // Initialize form data
      setFormData({
        firstName: profileData.profile?.firstName || '',
        lastName: profileData.profile?.lastName || '',
        phoneNumber: profileData.profile?.phoneNumber || '',
        dateOfBirth: profileData.profile?.dateOfBirth || '',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile information');
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.firstName.trim().length === 0) {
      newErrors.firstName = 'First name is required';
    }

    if (formData.lastName.trim().length === 0) {
      newErrors.lastName = 'Last name is required';
    }

    if (formData.phoneNumber && !/^\+?[1-9]\d{1,14}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Invalid phone number format';
    }

    if (formData.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(formData.dateOfBirth)) {
      newErrors.dateOfBirth = 'Date must be in YYYY-MM-DD format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setIsSaving(true);
      const updatedProfile = await userService.updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
      });

      setProfile(updatedProfile);
      setIsEditing(false);

      // Update auth store user if needed
      if (user) {
        setUser({
          ...user,
          firstName: updatedProfile.profile?.firstName || undefined,
          lastName: updatedProfile.profile?.lastName || undefined,
        });
      }

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    setFormData({
      firstName: profile?.profile?.firstName || '',
      lastName: profile?.profile?.lastName || '',
      phoneNumber: profile?.profile?.phoneNumber || '',
      dateOfBirth: profile?.profile?.dateOfBirth || '',
    });
    setErrors({});
    setIsEditing(false);
  };

  const getKycStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return colors.success;
      case 'rejected':
        return colors.error;
      default:
        return colors.warning;
    }
  };

  const getKycStatusText = (status: string) => {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending';
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <LoadingSpinner />
      </ScreenContainer>
    );
  }

  if (!profile) {
    return (
      <ScreenContainer>
        <Text>Failed to load profile</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Card style={styles.profileCard}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile Information</Text>
            {!isEditing && (
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Details</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{profile.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>KYC Status:</Text>
              <View style={styles.kycStatus}>
                <View
                  style={[
                    styles.kycIndicator,
                    { backgroundColor: getKycStatusColor(profile.kycStatus) },
                  ]}
                />
                <Text style={styles.value}>{getKycStatusText(profile.kycStatus)}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Member Since:</Text>
              <Text style={styles.value}>
                {new Date(profile.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <Input
              label="First Name"
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              error={errors.firstName}
              editable={isEditing}
              style={!isEditing && styles.disabledInput}
            />

            <Input
              label="Last Name"
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              error={errors.lastName}
              editable={isEditing}
              style={!isEditing && styles.disabledInput}
            />

            <Input
              label="Phone Number"
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
              error={errors.phoneNumber}
              placeholder="+1234567890"
              keyboardType="phone-pad"
              editable={isEditing}
              style={!isEditing && styles.disabledInput}
            />

            <Input
              label="Date of Birth"
              value={formData.dateOfBirth}
              onChangeText={(text) => setFormData({ ...formData, dateOfBirth: text })}
              error={errors.dateOfBirth}
              placeholder="YYYY-MM-DD"
              editable={isEditing}
              style={!isEditing && styles.disabledInput}
            />
          </View>

          {isEditing && (
            <View style={styles.buttonContainer}>
              <Button
                title="Cancel"
                onPress={handleCancel}
                variant="outline"
                style={styles.button}
              />
              <Button
                title="Save"
                onPress={handleSave}
                loading={isSaving}
                style={styles.button}
              />
            </View>
          )}
        </Card>

        <Card style={styles.actionCard}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('SecuritySettings')}
          >
            <Text style={styles.actionText}>Security Settings</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => navigation.navigate('PaymentMethods')}
          >
            <Text style={styles.actionText}>Payment Methods</Text>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileCard: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  editButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  editButtonText: {
    ...typography.button,
    color: colors.primary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
  },
  kycStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kycIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  disabledInput: {
    backgroundColor: colors.backgroundSecondary,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  actionCard: {
    marginBottom: spacing.md,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  actionText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  actionArrow: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
});