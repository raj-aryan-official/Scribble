// src/context/ProfileContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import { loadProfile, saveProfile, exportProfile, deleteProfile } from '../lib/profile';

export const ProfileContext = createContext();

const DEFAULT_PROFILE = {
  nickname: '',
  avatar: { face: null, hair: null, hat: null, accessory: null, colour: '#ffcc00' },
  xp: 0,
  level: 1,
  stats: { games: 0, wins: 0, correctGuesses: 0, likedDrawings: 0 },
  badges: [], // badge IDs
  createdAt: new Date().toISOString(),
};

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);

  // Load persisted profile on mount
  useEffect(() => {
    const stored = loadProfile();
    if (stored) setProfile(stored);
  }, []);

  // Persist on any change
  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const addXp = (earned) => {
    setProfile((prev) => {
      const newXp = prev.xp + earned;
      const newLevel = Math.floor(newXp / 100) + 1; // level n needs 100*n XP
      return { ...prev, xp: newXp, level: newLevel };
    });
  };

  const unlockBadge = (badgeId) => {
    setProfile((prev) => {
      if (prev.badges.includes(badgeId)) return prev;
      return { ...prev, badges: [...prev.badges, badgeId] };
    });
  };

  const setAvatarPart = (partKey, partId) => {
    setProfile((prev) => ({
      ...prev,
      avatar: { ...prev.avatar, [partKey]: partId },
    }));
  };

  const incStat = (statKey, delta = 1) => {
    setProfile((prev) => ({
      ...prev,
      stats: { ...prev.stats, [statKey]: (prev.stats[statKey] || 0) + delta },
    }));
  };

  const handleDelete = () => {
    deleteProfile();
    setProfile(DEFAULT_PROFILE);
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        setProfile,
        addXp,
        unlockBadge,
        setAvatarPart,
        incStat,
        exportProfile,
        deleteProfile: handleDelete,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

