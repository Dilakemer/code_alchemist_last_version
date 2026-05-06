import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { getCommunityFeed, getFollowingFeed } from '../services/api';

export default function CommunityFeed({ token, onSelectPost, mode = 'all' }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchFeed();
  }, [mode]);

  const fetchFeed = async () => {
    try {
      let data;
      if (mode === 'following') {
        data = await getFollowingFeed(token);
        setMessage(data.message || '');
        setPosts(data.feed || []);
      } else {
        data = await getCommunityFeed();
        setPosts(data.posts || []);
        setMessage('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color="#d946ef" />;

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d946ef" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{mode === 'following' ? 'Following Feed' : 'Community Feed'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'following' 
            ? 'See what your network is transmuting' 
            : 'Explore transmutations from fellow alchemists'}
        </Text>
      </View>

      {message ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{message}</Text>
        </View>
      ) : null}

      {posts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {mode === 'following' 
              ? 'No posts from people you follow yet.' 
              : 'No community posts yet. Be the first to share!'}
          </Text>
        </View>
      ) : (
        posts.map((post) => (
          <TouchableOpacity 
            key={post.id} 
            style={styles.postCard}
            onPress={() => onSelectPost(post)}
          >
            <View style={styles.authorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{post.author?.[0]?.toUpperCase() || 'A'}</Text>
              </View>
              <View>
                <Text style={styles.authorName}>{post.author || 'Anonymous'}</Text>
                <Text style={styles.postDate}>{new Date(post.created_at || post.timestamp).toLocaleDateString()}</Text>
              </View>
              <View style={styles.modelBadge}>
                <Text style={styles.modelText}>{post.selected_model || 'AI'}</Text>
              </View>
            </View>

            <Text style={styles.postQuestion} numberOfLines={2}>{post.user_question}</Text>
            
            {post.ai_response ? (
              <View style={styles.responsePreview}>
                <Text style={styles.responseText} numberOfLines={4}>{post.ai_response}</Text>
              </View>
            ) : null}

            <View style={styles.footer}>
              <View style={styles.stat}>
                <Text style={styles.statIcon}>❤️</Text>
                <Text style={styles.statVal}>{post.likes || 0}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statIcon}>💬</Text>
                <Text style={styles.statVal}>{post.comments_count || 0}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 4, fontWeight: '600' },
  infoBox: {
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.2)',
  },
  infoText: { color: '#7dd3fc', fontSize: 13, textAlign: 'center' },
  postCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarText: { color: '#d946ef', fontWeight: '800', fontSize: 16 },
  authorName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  postDate: { color: '#475569', fontSize: 12 },
  modelBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(217, 70, 239, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modelText: { color: '#d946ef', fontSize: 11, fontWeight: '800' },
  postQuestion: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  responsePreview: {
    backgroundColor: '#020617',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
  },
  responseText: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  footer: { flexDirection: 'row', gap: 20, borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIcon: { fontSize: 14 },
  statVal: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', textAlign: 'center' },
});
