import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/remote_client.dart';
import 'theme.dart';

/// Song library sent from the desktop. Search is server-side and understands
/// non-Latin scripts; the debounce here just avoids a command per keystroke.
class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key, required this.client});

  final RemoteClient client;

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  final _search = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    // Empty query lists everything, so the screen is useful before typing.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.client.searchSongs('');
    });
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      widget.client.searchSongs(value.trim());
    });
  }

  void _project(String songId) {
    if (!widget.client.isConnected) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Reconnect to the desktop first.')),
      );
      return;
    }
    unawaited(HapticFeedback.selectionClick());
    widget.client.projectItem(songId);
    Navigator.of(context).pop();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Song library'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => widget.client.searchSongs(_search.text.trim()),
            icon: const Icon(Icons.refresh),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
            child: TextField(
              controller: _search,
              onChanged: _onQueryChanged,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Search by title, author, or lyric…',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _search.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Clear',
                        onPressed: () {
                          _search.clear();
                          setState(() {});
                          widget.client.searchSongs('');
                        },
                        icon: const Icon(Icons.close),
                      ),
              ),
            ),
          ),
          if (!widget.client.isConnected)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: CpColors.warning.withValues(alpha: 0.1),
              child: const Text(
                'You are offline — showing the last results received.',
                style: TextStyle(color: CpColors.warning, fontSize: 12),
              ),
            ),
          Expanded(
            child: AnimatedBuilder(
              animation: widget.client,
              builder: (context, _) {
                final songs = widget.client.songs;
                if (songs.isEmpty) {
                  return _EmptyLibrary(
                    searching: _search.text.trim().isNotEmpty,
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(12, 2, 12, 24),
                  itemCount: songs.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final song = songs[index];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      leading: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: CpColors.accentSoft,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.music_note,
                          size: 20,
                          color: CpColors.accent,
                        ),
                      ),
                      title: Text(
                        song.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: CpColors.text,
                          fontWeight: FontWeight.w600,
                          fontSize: 14.5,
                        ),
                      ),
                      subtitle: Text(
                        [
                          if (song.author.isNotEmpty) song.author,
                          if (song.key.isNotEmpty) 'Key ${song.key}',
                          '${song.slideCount} slides',
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: CpColors.textMuted,
                          fontSize: 11.5,
                        ),
                      ),
                      trailing: const Icon(
                        Icons.play_circle_outline,
                        color: CpColors.textMuted,
                      ),
                      onTap: () => _project(song.id),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyLibrary extends StatelessWidget {
  const _EmptyLibrary({required this.searching});

  final bool searching;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              searching ? Icons.search_off : Icons.library_music_outlined,
              size: 40,
              color: CpColors.textMuted,
            ),
            const SizedBox(height: 12),
            Text(
              searching
                  ? 'No songs match that search.'
                  : 'The library is empty.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: CpColors.text, fontSize: 15),
            ),
            const SizedBox(height: 6),
            Text(
              searching
                  ? 'Try a word from the title or lyrics, in any language.'
                  : 'Add songs on the laptop — they appear here automatically.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: CpColors.textMuted,
                fontSize: 12.5,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
