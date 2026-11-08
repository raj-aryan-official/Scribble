import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import AvatarPicker from '../ui/AvatarPicker';
import Avatar from '../ui/Avatar';

export const AvatarEditModal = ({
    isOpen,
    onClose,
    currentAvatar = 'avatar-1',
    onSave,
}) => {
    const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar);

    useEffect(() => {
        if (isOpen) {
            setSelectedAvatar(currentAvatar);
        }
    }, [isOpen, currentAvatar]);

    const handleSave = () => {
        onSave?.(selectedAvatar);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Change Your Avatar"
            description="Choose how other players see you in the game"
            className="max-w-md text-center"
        >
            <div className="flex flex-col items-center gap-5">
                {/* Large Preview */}
                <div className="relative">
                    <Avatar avatarId={selectedAvatar} size="lg" />
                </div>

                {/* Avatar Picker Carousel */}
                <AvatarPicker
                    selectedAvatar={selectedAvatar}
                    onSelect={setSelectedAvatar}
                    className="w-full"
                />

                {/* Actions */}
                <div className="flex items-center gap-3 w-full justify-end pt-3 border-t-2 border-ink/10">
                    <Button
                        variant="secondary"
                        size="md"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        onClick={handleSave}
                        className="bg-leaf hover:bg-leaf-deep text-white min-w-[100px]"
                    >
                        Save
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default AvatarEditModal;
