import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTags } from '../../hooks/useTags';
import { useThoughts } from '../../hooks/useThoughts';
import { renameTag, deleteTag } from '../../services/firestore';
import SearchBar from '../Explore/SearchBar';

const TagManagerTab: React.FC = () => {
  const { user } = useAuth();
  const { tags } = useTags(user?.uid);
  const { thoughts, editThought } = useThoughts(user?.uid);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleStartEdit = (tagId: string, currentName: string) => {
    setEditingTagId(tagId);
    setNewTagName(currentName);
  };

  const handleCancelEdit = () => {
    setEditingTagId(null);
    setNewTagName('');
  };

  const handleRenameTag = async (oldName: string) => {
    const trimmedNewName = newTagName.trim();

    if (!user || !trimmedNewName) {
      handleCancelEdit();
      return;
    }

    // If only capitalization changed, still proceed with the rename
    if (trimmedNewName.toLowerCase() === oldName.toLowerCase() && trimmedNewName !== oldName) {
      console.log('Changing capitalization:', oldName, '->', trimmedNewName);
    } else if (trimmedNewName === oldName) {
      // Exact match, no change needed
      handleCancelEdit();
      return;
    }

    console.log('Renaming tag:', oldName, '->', trimmedNewName);

    try {
      // Find all thoughts with this tag (case-insensitive match)
      const thoughtsWithTag = thoughts.filter(t =>
        t.tags.some(tag => tag.toLowerCase() === oldName.toLowerCase())
      );

      console.log(`Found ${thoughtsWithTag.length} thoughts with tag "${oldName}"`);

      // Update all thoughts with the renamed tag
      for (const thought of thoughtsWithTag) {
        const updatedTags = thought.tags.map(tag =>
          tag.toLowerCase() === oldName.toLowerCase() ? trimmedNewName : tag
        );

        console.log(`Updating thought ${thought.id}:`, thought.tags, '->', updatedTags);
        await editThought(thought.id, { tags: updatedTags });
      }

      // Rename the tag in the tags collection
      console.log('Renaming tag document in Firestore...');
      await renameTag(user.uid, oldName, trimmedNewName);

      console.log('Tag renamed successfully');
      handleCancelEdit();
    } catch (error) {
      console.error('Error renaming tag:', error);
      alert('Failed to rename tag. Please try again.');
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    if (!user) return;

    // Find thoughts with this tag (case-insensitive)
    const thoughtsWithTag = thoughts.filter(t =>
      t.tags.some(tag => tag.toLowerCase() === tagName.toLowerCase())
    );

    const confirmMessage = thoughtsWithTag.length > 0
      ? `This tag is used in ${thoughtsWithTag.length} thought(s). Deleting it will remove it from all thoughts. Continue?`
      : 'Are you sure you want to delete this tag?';

    if (!window.confirm(confirmMessage)) {
      setDeletingTagId(null);
      return;
    }

    try {
      console.log(`Deleting tag "${tagName}" from ${thoughtsWithTag.length} thoughts`);

      // Remove tag from all thoughts (case-insensitive)
      for (const thought of thoughtsWithTag) {
        const updatedTags = thought.tags.filter(
          tag => tag.toLowerCase() !== tagName.toLowerCase()
        );
        console.log(`Removing tag from thought ${thought.id}:`, thought.tags, '->', updatedTags);
        await editThought(thought.id, { tags: updatedTags });
      }

      // Delete the tag from the tags collection
      console.log('Deleting tag document from Firestore...');
      await deleteTag(user.uid, tagName);

      console.log('Tag deleted successfully');
      setDeletingTagId(null);
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert('Failed to delete tag. Please try again.');
    }
  };

  if (tags.length === 0) {
    return (
      <div className="tag-manager-tab">
        <div className="tag-manager-header">
          <h2 className="gradient-text">Tag Manager</h2>
        </div>
        <div className="empty-state">
          <p>No tags yet. Tags are created when you use them in your thoughts.</p>
        </div>
      </div>
    );
  }

  // Filter tags based on search query
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="tag-manager-tab">
      <div className="tag-manager-header">
        <h2 className="gradient-text">Tag Manager</h2>
        <p className="subtitle">Rename or delete your existing tags</p>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search tags..."
      />

      <div className="tag-manager-list">
        {[...filteredTags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })).map((tag) => {
          // Count thoughts with this tag (case-insensitive)
          const thoughtCount = thoughts.filter(t =>
            t.tags.some(thoughtTag => thoughtTag.toLowerCase() === tag.name.toLowerCase())
          ).length;
          const isEditing = editingTagId === tag.id;

          return (
            <div key={tag.id} className="tag-manager-item">
              <div className="tag-manager-info">
                {isEditing ? (
                  <div
                    className="tag-manager-edit"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelEdit();
                      }
                    }}
                  >
                    <div className="tag-editor-input-wrapper">
                      <span className="tag-editor-hash">#</span>
                      <input
                        type="text"
                        className="tag-editor-input"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleRenameTag(tag.name);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    <div className="tag-manager-edit-actions">
                      <button
                        className="tag-manager-save-btn"
                        onClick={() => handleRenameTag(tag.name)}
                      >
                        Save
                      </button>
                      <button
                        className="tag-manager-cancel-btn"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="tag-manager-name-section">
                      <span className="tag-manager-name">#{tag.name}</span>
                      <span className="tag-manager-count">{thoughtCount} thought{thoughtCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="tag-manager-actions">
                      <button
                        className="tag-manager-rename-btn"
                        onClick={() => handleStartEdit(tag.id, tag.name)}
                        title="Rename tag"
                      >
                        Rename
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteTag(tag.name)}
                        disabled={deletingTagId === tag.id}
                        title="Delete tag"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TagManagerTab;
