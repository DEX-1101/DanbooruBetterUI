import React, { useState, useEffect, useRef } from 'react';
import { Search, Image as ImageIcon, Info, Shield, ShieldAlert, Loader2, Tag as TagIcon, User, Copyright, Hash, X, Copy, Check, ExternalLink, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { searchTags, getTagWiki, getPostsByTag, getTag, getPostById } from './api';
import { Tag, Post, WikiPage } from './types';
import { motion, AnimatePresence } from 'motion/react';
import ChatMenu from './components/ChatMenu';
import ZoomableImage from './components/ZoomableImage';

const isVideo = (ext?: string) => {
  if (!ext) return false;
  return ['mp4', 'webm', 'zip'].includes(ext.toLowerCase());
};

const PostPreview: React.FC<{ id: string }> = ({ id }) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPostById(id).then(data => {
      setPost(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <span className="text-slate-400 italic">[Loading Post #{id}...]</span>;
  if (!post) return <span className="text-red-400 italic">[Post #{id} not found]</span>;

  const isVid = isVideo(post.file_ext);
  const previewUrl = post.preview_file_url || post.file_url;

  if (!previewUrl) {
    return (
      <a href={`https://danbooru.donmai.us/posts/${id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-300 hover:underline">
        [Deleted Post #{id}]
        <ExternalLink className="w-3 h-3 inline" />
      </a>
    );
  }

  return (
    <a href={`https://danbooru.donmai.us/posts/${id}`} target="_blank" rel="noopener noreferrer" className="inline-block m-1 border border-slate-700 rounded overflow-hidden hover:border-indigo-500 transition-colors relative group bg-slate-800/50">
      {isVid && !post.preview_file_url ? (
        <video src={post.file_url} className="h-32 w-auto object-cover" autoPlay loop muted playsInline />
      ) : (
        <img src={previewUrl} alt={`Post #${id}`} className="h-32 w-auto object-cover" referrerPolicy="no-referrer" />
      )}
      {(isVid || post.file_ext === 'gif') && (
        <div className="absolute top-1 right-1 bg-black/60 rounded p-1 pointer-events-none">
          <Play className="w-3 h-3 text-white fill-white" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-white p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
        Post #{id}
      </div>
    </a>
  );
};

const renderDText = (text: string, onTagClick: (tag: string) => void) => {
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrike = false;
  let isSpoiler = false;
  let isQuote = false;

  const renderInline = (inlineText: string, lineKey: number) => {
    // Regex matches DText inline elements
    const regex = /(\[\[.*?\]\]|"[^"]+":\S+|\[url=.*?\].*?\[\/url\]|\[url\].*?\[\/url\]|\[(?:tag|wiki|artist|copyright|character|general|meta)(?:=.*?)?\].*?\[\/(?:tag|wiki|artist|copyright|character|general|meta)\]|!?(?:post|comment|forum|pool|set|favgroup|user|asset)\s*#\d+|(?:https?:\/\/\S+)|\[b\]|\[\/b\]|\[i\]|\[\/i\]|\[u\]|\[\/u\]|\[s\]|\[\/s\]|\[spoiler\]|\[\/spoiler\]|\[spoilers\]|\[\/spoilers\]|\[quote\]|\[\/quote\]|<br>)/gim;
    const parts = inlineText.split(regex);

    return parts.map((part, i) => {
      if (!part) return null;

      const lowerPart = part.toLowerCase();
      if (lowerPart === '[b]') { isBold = true; return null; }
      if (lowerPart === '[/b]') { isBold = false; return null; }
      if (lowerPart === '[i]') { isItalic = true; return null; }
      if (lowerPart === '[/i]') { isItalic = false; return null; }
      if (lowerPart === '[u]') { isUnderline = true; return null; }
      if (lowerPart === '[/u]') { isUnderline = false; return null; }
      if (lowerPart === '[s]') { isStrike = true; return null; }
      if (lowerPart === '[/s]') { isStrike = false; return null; }
      if (lowerPart === '[spoiler]' || lowerPart === '[spoilers]') { isSpoiler = true; return null; }
      if (lowerPart === '[/spoiler]' || lowerPart === '[/spoilers]') { isSpoiler = false; return null; }
      if (lowerPart === '[quote]') { isQuote = true; return null; }
      if (lowerPart === '[/quote]') { isQuote = false; return null; }
      if (lowerPart === '<br>') { return <br key={i} />; }

      const getClasses = (base: string) => {
        let cls = base;
        if (isBold) cls += ' font-bold text-white';
        if (isItalic) cls += ' italic';
        if (isUnderline) cls += ' underline';
        if (isStrike) cls += ' line-through';
        if (isSpoiler) cls += ' bg-slate-800 text-transparent hover:text-slate-200 transition-colors cursor-help px-1 rounded';
        if (isQuote) cls += ' text-slate-400 italic';
        return cls.trim() || undefined;
      };

      // 1. Tag link: [[tag]] or [[tag|label]]
      const tagMatch = part.match(/^\[\[(.*?)\]\]$/);
      if (tagMatch) {
        const content = tagMatch[1];
        const [tag, label] = content.includes('|') ? content.split('|') : [content, content];
        return (
          <a 
            key={i} 
            href="#" 
            onClick={(e) => { e.preventDefault(); onTagClick(tag); }}
            className={getClasses("text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer")}
          >
            {label}
          </a>
        );
      }
      
      // 2. External link: "text":url
      const linkMatch = part.match(/^"([^"]+)":(\S+)$/);
      if (linkMatch) {
        const [, label, url] = linkMatch;
        let href = url;
        if (url.startsWith('/')) href = `https://danbooru.donmai.us${url}`;
        else if (!url.startsWith('http')) href = `https://danbooru.donmai.us/${url}`;
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={getClasses("text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer inline-flex items-center gap-1")}>
            {label}
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        );
      }

      // 3. [url=url]label[/url] or [url]label[/url]
      const urlTagMatch = part.match(/^\[url=(.*?)\](.*?)\[\/url\]$/i) || part.match(/^\[url\](.*?)\[\/url\]$/i);
      if (urlTagMatch) {
        const url = urlTagMatch[1];
        const label = urlTagMatch[2] || url;
        let href = url;
        if (url.startsWith('/')) href = `https://danbooru.donmai.us${url}`;
        else if (!url.startsWith('http')) href = `https://danbooru.donmai.us/${url}`;
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={getClasses("text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer inline-flex items-center gap-1")}>
            {label}
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        );
      }

      // 4. [tag=tag]label[/tag]
      const tagTypeMatch = part.match(/^\[(tag|wiki|artist|copyright|character|general|meta)(?:=(.*?))?\](.*?)\[\/\1\]$/i);
      if (tagTypeMatch) {
        const [, type, tagVal, label] = tagTypeMatch;
        const tag = tagVal || label;
        if (type.toLowerCase() === 'wiki') {
          return (
            <a key={i} href={`https://danbooru.donmai.us/wiki_pages/${tag}`} target="_blank" rel="noopener noreferrer" className={getClasses("text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer inline-flex items-center gap-1")}>
              {label}
              <ExternalLink className="w-3 h-3 inline" />
            </a>
          );
        }
        return (
          <a key={i} href="#" onClick={(e) => { e.preventDefault(); onTagClick(tag); }} className={getClasses("text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer")}>
            {label}
          </a>
        );
      }

      // 5. Post/Comment/etc links: post #123 or !post #123
      const refMatch = part.match(/^(!?)(post|comment|forum|pool|set|favgroup|user|asset)\s*#(\d+)$/i);
      if (refMatch) {
        const [, isEmbed, type, id] = refMatch;
        if (isEmbed && type.toLowerCase() === 'post') {
          return <PostPreview key={i} id={id} />;
        }
        const href = `https://danbooru.donmai.us/${type}s/${id}`;
        return (
          <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={getClasses("text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer inline-flex items-center gap-1")}>
            {isEmbed ? `[Image: ${type} #${id}]` : `${type} #${id}`}
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        );
      }

      // 6. Plain URL
      if (lowerPart.startsWith('http')) {
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={getClasses("text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer inline-flex items-center gap-1")}>
            {part.length > 40 ? part.substring(0, 37) + '...' : part}
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        );
      }

      // 8. Plain text
      return <span key={i} className={getClasses("")}>{part}</span>;
    });
  };

  return lines.map((line, lineIndex) => {
    // Check for header
    const headerMatch = line.match(/^\s*h(\d)(?:#[\w-]+)?\.\s*(.*)$/i);
    if (headerMatch) {
      const level = parseInt(headerMatch[1]);
      const content = headerMatch[2];
      const Tag = `h${level}` as any;
      const fontSize = level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : level === 3 ? 'text-lg' : 'text-base';
      return (
        <Tag key={lineIndex} className={`${fontSize} text-white font-bold mt-6 mb-3 border-b border-slate-800/50 pb-2`}>
          {renderInline(content, lineIndex)}
        </Tag>
      );
    }

    // Check for list items
    const listMatch = line.match(/^\s*(\*+)\s*(.*)$/);
    if (listMatch) {
      const depth = listMatch[1].length;
      const content = listMatch[2];
      return (
        <div key={lineIndex} style={{ marginLeft: `${(depth - 1) * 1.5}rem` }} className="flex items-start gap-2 my-1">
          <span className="text-slate-500 mt-1">•</span>
          <div>{renderInline(content, lineIndex)}</div>
        </div>
      );
    }

    // Check for numbered list items
    const numListMatch = line.match(/^\s*(#+)\s*(.*)$/);
    if (numListMatch) {
      const depth = numListMatch[1].length;
      const content = numListMatch[2];
      return (
        <div key={lineIndex} style={{ marginLeft: `${(depth - 1) * 1.5}rem` }} className="flex items-start gap-2 my-1">
          <span className="text-slate-500 font-mono text-sm mt-0.5">{depth}.</span>
          <div>{renderInline(content, lineIndex)}</div>
        </div>
      );
    }

    // Blockquote
    const quoteMatch = line.match(/^\s*>\s*(.*)$/);
    if (quoteMatch) {
      const content = quoteMatch[1];
      return (
        <blockquote key={lineIndex} className="border-l-4 border-indigo-500/50 pl-4 py-1 my-2 text-slate-400 bg-slate-800/30 rounded-r-lg">
          {renderInline(content, lineIndex)}
        </blockquote>
      );
    }

    // Normal line
    return (
      <div key={lineIndex} className="min-h-[1.5rem] my-1">
        {renderInline(line, lineIndex)}
      </div>
    );
  });
};

const CustomVideoPlayer = ({ src, className, onPlayPause }: { src: string, className?: string, onPlayPause?: (playing: boolean) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
      onPlayPause?.(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
      if (newMuted) {
        setVolume(0);
      } else {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = (parseFloat(e.target.value) / 100) * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      setProgress(parseFloat(e.target.value));
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2000);
  };

  const handleMouseLeave = () => {
    if (isPlaying) setShowControls(false);
  };

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        playsInline
        className={className}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => { setIsBuffering(false); setIsPlaying(true); onPlayPause?.(true); }}
        onPlay={() => { setIsPlaying(true); onPlayPause?.(true); }}
        onPause={() => { setIsPlaying(false); onPlayPause?.(false); }}
        onClick={(e) => {
          const video = e.currentTarget;
          const rect = video.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          if (y > rect.height - 50) return;
          
          if (x > rect.width * 0.7) {
            video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
          } else if (x < rect.width * 0.3) {
            video.currentTime = Math.max(0, video.currentTime - 5);
          } else {
            togglePlay();
          }
        }}
      />
      
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-12 h-12 text-white animate-spin opacity-75" />
        </div>
      )}

      {/* Controls Overlay */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white text-xs font-mono w-10 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          />
          <span className="text-white text-xs font-mono w-10">{formatTime(duration)}</span>
        </div>
        
        {/* Bottom Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-indigo-400 transition-colors">
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
            
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white hover:text-indigo-400 transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 transition-all duration-300 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CATEGORY_COLORS: Record<number, { bg: string, text: string, icon: React.ReactNode }> = {
  0: { bg: 'bg-blue-500/20', text: 'text-blue-300', icon: <Hash className="w-4 h-4" /> }, // General
  1: { bg: 'bg-red-500/20', text: 'text-red-300', icon: <User className="w-4 h-4" /> }, // Artist
  3: { bg: 'bg-purple-500/20', text: 'text-purple-300', icon: <Copyright className="w-4 h-4" /> }, // Copyright
  4: { bg: 'bg-green-500/20', text: 'text-green-300', icon: <User className="w-4 h-4" /> }, // Character
  5: { bg: 'bg-orange-500/20', text: 'text-orange-300', icon: <TagIcon className="w-4 h-4" /> }, // Meta
};

const CATEGORY_NAMES: Record<number, string> = {
  0: 'General',
  1: 'Artist',
  3: 'Copyright',
  4: 'Character',
  5: 'Meta',
};

const RunningLines = () => {
  return (
    <div 
      className="absolute -inset-[2px] pointer-events-none z-0 rounded-2xl overflow-hidden"
      style={{
        WebkitMaskImage: 'linear-gradient(to right, black 35%, transparent 45% 55%, black 65%)',
        maskImage: 'linear-gradient(to right, black 35%, transparent 45% 55%, black 65%)'
      }}
    >
      <div 
        className="absolute top-[-150%] left-[-150%] w-[400%] h-[400%] animate-rotateGlow"
        style={{
          background: 'conic-gradient(from 0deg, transparent 20%, rgba(255, 0, 0, 0.8) 25%, transparent 30%, transparent 70%, rgba(0, 100, 255, 0.8) 75%, transparent 80%)'
        }}
      />
    </div>
  );
};

export default function App() {
  const [queryTags, setQueryTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [debouncedWord] = useDebounce(inputValue, 300);
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [wiki, setWiki] = useState<WikiPage | null>(null);
  const [isWikiExpanded, setIsWikiExpanded] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const [selectedImagePost, setSelectedImagePost] = useState<Post | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [showUnderscores, setShowUnderscores] = useState(() => {
    const saved = localStorage.getItem('showUnderscores');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());
  
  const [safeMode, setSafeMode] = useState(() => {
    const saved = localStorage.getItem('safeMode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const handleDownload = async (post: Post) => {
    if (!post || downloadingIds.has(post.id)) return;
    setDownloadingIds(prev => new Set(prev).add(post.id));
    try {
      // Fetch the full post details from the API to ensure we get the original file_url
      // Sometimes the list API omits the original file_url for large images
      let url = post.file_url;
      
      try {
        const fullPost = await getPostById(post.id.toString());
        if (fullPost && fullPost.file_url) {
          url = fullPost.file_url;
        }
      } catch (err) {
        console.warn("Failed to fetch full post details, falling back to cached URLs", err);
      }

      // Fallback to large_file_url if original is completely unavailable
      if (!url) {
        url = post.large_file_url;
      }
      
      if (!url) throw new Error("No URL available");
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      
      let filename = `danbooru_${post.id}.${post.file_ext}`;
      if (url.includes('url=')) {
        const decoded = decodeURIComponent(url.split('url=')[1]);
        const extracted = decoded.split('/').pop()?.split('?')[0];
        if (extracted) filename = extracted;
      } else {
        const extracted = url.split('/').pop()?.split('?')[0];
        if (extracted) filename = extracted;
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download image.");
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  };

  const updateNavButtons = (forcedIndex?: number) => {
    const currentIndex = typeof forcedIndex === 'number' ? forcedIndex : (window.history.state?.index || 0);
    const maxIndex = parseInt(sessionStorage.getItem('maxHistoryIndex') || '0', 10);
    
    // Ensure maxIndex is at least currentIndex to prevent invalid states
    const effectiveMaxIndex = Math.max(maxIndex, currentIndex);
    if (effectiveMaxIndex > maxIndex) {
      sessionStorage.setItem('maxHistoryIndex', effectiveMaxIndex.toString());
    }

    setCanGoBack(currentIndex > 0);
    setCanGoForward(currentIndex < effectiveMaxIndex);
  };

  const maxPages = selectedTag ? Math.ceil(selectedTag.post_count / 50) : 0;

  const dropdownRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const skipNextDropdownRef = useRef(false);
  
  const isRestoringHistoryRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const selectedTagRef = useRef<Tag | null>(null);
  const currentPageRef = useRef<number>(1);
  
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions, showDropdown]);

  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  useEffect(() => {
    selectedTagRef.current = selectedTag;
  }, [selectedTag]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    if (!window.history.state || typeof window.history.state.index !== 'number') {
      window.history.replaceState({ index: 0, tag: null, page: 1, query: '' }, '');
      sessionStorage.setItem('maxHistoryIndex', '0');
    }
    
    updateNavButtons();
    
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && typeof e.state.index === 'number') {
        const newIndex = e.state.index;
        updateNavButtons(newIndex);
        
        isRestoringHistoryRef.current = true;
        skipNextDropdownRef.current = true;
        setShowDropdown(false);
        
        const previousTag = selectedTagRef.current;
        const newTag = e.state.tag;
        
        setSelectedTag(newTag);
        setCurrentPage(e.state.page);
        
        if (e.state.query) {
          setQueryTags(e.state.query.split(/\s+/).filter(Boolean));
        } else if (newTag) {
          setQueryTags([newTag.name]);
        } else {
          setQueryTags([]);
        }
        setInputValue('');
        
        setIsWikiExpanded(false);
        
        if (newTag) {
          setIsLoadingDetails(true);
          
          const promises: Promise<any>[] = [];
          
          if (!previousTag || previousTag.name !== newTag.name) {
            promises.push(
              getTagWiki(newTag.name).then(setWiki),
              getTag(newTag.name).then(details => {
                if (details) setSelectedTag(details);
              })
            );
          }
          
          promises.push(
            getPostsByTag(newTag.name, safeMode, e.state.page).then(({ posts: postsData, hasMore }) => {
              setHasMore(hasMore);
              setPosts(postsData.filter(p => p.file_url || p.preview_file_url));
            })
          );
          
          Promise.all(promises).finally(() => {
            setIsLoadingDetails(false);
            updateNavButtons(newIndex);
          });
        } else {
          setWiki(null);
          setPosts([]);
          updateNavButtons(newIndex);
        }
        
        setTimeout(() => {
          isRestoringHistoryRef.current = false;
        }, 0);
      } else {
        updateNavButtons(0);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [safeMode]);

  useEffect(() => {
    localStorage.setItem('showUnderscores', JSON.stringify(showUnderscores));
  }, [showUnderscores]);

  useEffect(() => {
    localStorage.setItem('safeMode', JSON.stringify(safeMode));
  }, [safeMode]);

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const formatTag = (tag: string) => showUnderscores ? tag : tag.replace(/_/g, ' ');

  const getOrderedTagsWithCategory = (post: Post) => {
    const parseTags = (str: string, category: number) => 
      (str ? str.split(' ').filter(Boolean) : []).map(tag => ({ tag, category }));
    
    return [
      ...parseTags(post.tag_string_artist, 1),
      ...parseTags(post.tag_string_copyright, 3),
      ...parseTags(post.tag_string_character, 4),
      ...parseTags(post.tag_string_general, 0),
      ...parseTags(post.tag_string_meta, 5),
    ];
  };

  const handleCopyAllTags = (post: Post) => {
    const orderedTags = getOrderedTagsWithCategory(post)
      .filter(t => t.category !== 5) // Ignore meta tags
      .map(t => t.tag);
    const formattedTags = orderedTags.map(formatTag).join(', ');
    navigator.clipboard.writeText(formattedTags);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySingleTag = (tag: string) => {
    navigator.clipboard.writeText(formatTag(tag));
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImagePost) return;
      
      const target = e.target as HTMLElement;
      // If the user is typing in an input or interacting with a video, don't navigate
      if (['INPUT', 'TEXTAREA', 'VIDEO'].includes(target.tagName)) {
        return;
      }

      const currentIndex = posts.findIndex(p => p.id === selectedImagePost.id);
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setSelectedImagePost(posts[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && currentIndex < posts.length - 1) {
        setSelectedImagePost(posts[currentIndex + 1]);
      } else if (e.key === 'Escape') {
        setSelectedImagePost(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImagePost, posts]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedWord.trim()) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      const results = await searchTags(debouncedWord);
      setSuggestions(results);
      setIsSearching(false);
      
      if (skipNextDropdownRef.current) {
        skipNextDropdownRef.current = false;
      } else {
        setShowDropdown(true);
      }
    };
    fetchSuggestions();
  }, [debouncedWord]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagClick = (tagName: string) => {
    const formattedTag = tagName.toLowerCase().replace(/ /g, '_');
    handleSelectTag({ 
      id: 0, 
      name: formattedTag, 
      category: 0, 
      post_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  };

  const handleSearchSubmit = async () => {
    const finalTags = [...queryTags];
    if (inputValue.trim()) {
      finalTags.push(inputValue.trim());
      setQueryTags(finalTags);
      setInputValue('');
    }
    
    const formattedQuery = finalTags.join(' ').toLowerCase();
    
    if (!formattedQuery) return;
    
    // If it's a single tag, we can use handleTagClick
    if (finalTags.length === 1) {
      handleTagClick(finalTags[0]);
      return;
    }
    
    // If it's multiple tags, we just search for posts
    skipNextDropdownRef.current = true;
    setShowDropdown(false);
    
    // Create a dummy tag for selectedTag
    const dummyTag: Tag = {
      id: 0,
      name: formattedQuery,
      category: 0,
      post_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setSelectedTag(dummyTag);
    setCurrentPage(1);
    setIsWikiExpanded(false);
    setIsLoadingDetails(true);
    setWiki(null); // No wiki for multiple tags
    
    if (!isRestoringHistoryRef.current) {
      const currentIndex = window.history.state?.index || 0;
      const newIndex = currentIndex + 1;
      window.history.pushState({ index: newIndex, tag: dummyTag, page: 1, query: formattedQuery }, '');
      sessionStorage.setItem('maxHistoryIndex', newIndex.toString());
      updateNavButtons(newIndex);
    }
    
    try {
      const { posts: postsData, hasMore } = await getPostsByTag(formattedQuery, safeMode, 1);
      setHasMore(hasMore);
      setPosts(postsData.filter(p => p.file_url || p.preview_file_url));
    } catch (error) {
      console.error("Failed to fetch posts for multi-tag search", error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSuggestionClick = (tag: Tag) => {
    skipNextDropdownRef.current = true;
    
    setQueryTags([...queryTags, tag.name]);
    setInputValue('');
    
    setShowDropdown(false);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleSelectTag = async (tag: Tag) => {
    skipNextDropdownRef.current = true;
    setQueryTags([tag.name]);
    setInputValue('');
    setShowDropdown(false);
    setSelectedTag(tag);
    setCurrentPage(1);
    setIsWikiExpanded(false);
    setIsLoadingDetails(true);
    
    if (!isRestoringHistoryRef.current) {
      const currentIndex = window.history.state?.index || 0;
      const newIndex = currentIndex + 1;
      window.history.pushState({ index: newIndex, tag, page: 1, query: tag.name }, '');
      sessionStorage.setItem('maxHistoryIndex', newIndex.toString());
      updateNavButtons(newIndex);
    }
    
    try {
      const [wikiData, { posts: postsData, hasMore }, tagDetails] = await Promise.all([
        getTagWiki(tag.name),
        getPostsByTag(tag.name, safeMode, 1),
        getTag(tag.name)
      ]);
      setWiki(wikiData);
      setHasMore(hasMore);
      setPosts(postsData.filter(p => p.file_url || p.preview_file_url)); // Filter out posts without images
      if (tagDetails) {
        setSelectedTag(tagDetails);
        if (!isRestoringHistoryRef.current) {
          const currentIndex = window.history.state?.index || 0;
          window.history.replaceState({ index: currentIndex, tag: tagDetails, page: 1, query: tag.name }, '');
          updateNavButtons(currentIndex);
        }
      }
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage) return;
    setCurrentPage(newPage);
    if (!isRestoringHistoryRef.current) {
      const currentQuery = queryTags.join(' ') + (inputValue.trim() ? ' ' + inputValue.trim() : '');
      const currentIndex = window.history.state?.index || 0;
      const newIndex = currentIndex + 1;
      window.history.pushState({ index: newIndex, tag: selectedTag, page: newPage, query: currentQuery || selectedTag?.name || '' }, '');
      sessionStorage.setItem('maxHistoryIndex', newIndex.toString());
      updateNavButtons(newIndex);
    }
  };

  const parseRelatedTags = (str?: string) => {
    if (!str) return [];
    const parts = str.split(' ');
    const tags: { tag: string, count: number }[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      if (parts[i] && parts[i+1]) {
        tags.push({ tag: parts[i], count: parseInt(parts[i+1]) });
      }
    }
    // Filter out the tag itself and sort by weight
    return tags.filter(t => t.tag !== selectedTag?.name).sort((a, b) => b.count - a.count);
  };

  // Re-fetch posts if safe mode or page changes and a tag is selected
  useEffect(() => {
    if (selectedTag && !isRestoringHistoryRef.current) {
      setIsLoadingDetails(true);
      getPostsByTag(selectedTag.name, safeMode, currentPage).then(({ posts: postsData, hasMore }) => {
        setHasMore(hasMore);
        setPosts(postsData.filter(p => p.file_url || p.preview_file_url));
        setIsLoadingDetails(false);
      });
    }
  }, [safeMode, currentPage]);

  // Reset page to 1 when safe mode changes
  useEffect(() => {
    if (!isRestoringHistoryRef.current) {
      setCurrentPage(1);
    }
  }, [safeMode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative overflow-x-hidden flex flex-col">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-slate-900/50 blur-[120px]" />
      </div>

      {/* Floating Controls */}
      <motion.div 
        layout
        className={`fixed z-40 flex flex-col sm:flex-row items-center gap-4 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          selectedTag || isLoadingDetails 
            ? 'top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl' 
            : 'top-[35%] left-1/2 -translate-x-1/2 w-[90%] max-w-2xl'
        }`}
      >
        {(canGoBack || canGoForward) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => window.history.back()}
            disabled={!canGoBack}
            className="hidden sm:flex p-3 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
        )}

        {/* Search Bar */}
        <motion.div layout className="relative w-full" ref={dropdownRef}>
          <form 
            className="relative shadow-2xl rounded-2xl group flex flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchSubmit();
            }}
          >
            <RunningLines />
            <div 
              className="w-full bg-slate-900/80 backdrop-blur-xl rounded-2xl py-2 pl-4 pr-[120px] sm:pr-[160px] focus-within:bg-slate-900/95 transition-all border border-slate-700/50 flex flex-wrap items-center gap-2 min-h-[52px] cursor-text relative z-10 shadow-inner"
              onClick={() => inputRef.current?.focus()}
            >
              {queryTags.map((tag, index) => (
                <span key={index} className="bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 text-sm font-medium border border-indigo-500/30">
                  {tag}
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newTags = queryTags.filter((_, i) => i !== index);
                      setQueryTags(newTags);
                      
                      // Trigger search immediately with the new tags
                      if (newTags.length > 0 || inputValue.trim()) {
                        // We need to pass the new tags directly since state update is async
                        const finalTags = [...newTags];
                        if (inputValue.trim()) {
                          finalTags.push(inputValue.trim());
                        }
                        
                        if (finalTags.length === 1) {
                          handleTagClick(finalTags[0]);
                        } else {
                          const formattedQuery = finalTags.join(' ').toLowerCase();
                          
                          // Create a dummy tag for selectedTag
                          const dummyTag = {
                            id: 0,
                            name: formattedQuery,
                            category: 0,
                            post_count: 0,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                          };
                          
                          setSelectedTag(dummyTag);
                          setCurrentPage(1);
                          setIsWikiExpanded(false);
                          setIsLoadingDetails(true);
                          setWiki(null);
                          setShowDropdown(false);
                          
                          if (!isRestoringHistoryRef.current) {
                            const currentIndex = window.history.state?.index || 0;
                            const newIndex = currentIndex + 1;
                            window.history.pushState({ index: newIndex, tag: dummyTag, page: 1, query: formattedQuery }, '');
                            sessionStorage.setItem('maxHistoryIndex', newIndex.toString());
                            updateNavButtons(newIndex);
                          }
                          
                          getPostsByTag(formattedQuery, safeMode, 1).then(({ posts: postsData, hasMore }) => {
                            setHasMore(hasMore);
                            setPosts(postsData.filter(p => p.file_url || p.preview_file_url));
                          }).catch(error => {
                            console.error("Failed to fetch posts for multi-tag search", error);
                          }).finally(() => {
                            setIsLoadingDetails(false);
                          });
                        }
                      } else {
                        // If no tags left, clear everything
                        setSelectedTag(null);
                        setPosts([]);
                        setWiki(null);
                        setShowDropdown(false);
                        
                        if (!isRestoringHistoryRef.current) {
                          const currentIndex = window.history.state?.index || 0;
                          const newIndex = currentIndex + 1;
                          window.history.pushState({ index: newIndex, tag: null, page: 1, query: '' }, '');
                          sessionStorage.setItem('maxHistoryIndex', newIndex.toString());
                          updateNavButtons(newIndex);
                        }
                      }
                      
                      inputRef.current?.focus();
                    }}
                    className="hover:text-white hover:bg-indigo-500/50 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes(' ')) {
                    const parts = val.split(/\s+/);
                    const newInputValue = parts.pop() || '';
                    const newTags = parts.filter(Boolean);
                    if (newTags.length > 0) {
                      setQueryTags([...queryTags, ...newTags]);
                    }
                    setInputValue(newInputValue);
                  } else {
                    setInputValue(val);
                  }
                  setShowDropdown(true);
                  skipNextDropdownRef.current = false;
                }}
                onKeyDown={(e) => {
                  if (showDropdown && suggestions.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
                      return;
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                      return;
                    } else if (e.key === 'Enter') {
                      if (selectedIndex >= 0) {
                        e.preventDefault();
                        handleSuggestionClick(suggestions[selectedIndex]);
                        return;
                      }
                    } else if (e.key === 'Escape') {
                      setShowDropdown(false);
                      return;
                    }
                  }
                  
                  if (e.key === 'Backspace' && !inputValue && queryTags.length > 0) {
                    e.preventDefault();
                    const newTags = [...queryTags];
                    const removed = newTags.pop();
                    setQueryTags(newTags);
                    setInputValue(removed || '');
                  }
                }}
                onFocus={() => {
                  if (inputValue.trim() && suggestions.length > 0) {
                    setShowDropdown(true);
                  }
                }}
                placeholder={queryTags.length === 0 ? "Search tags (e.g., hatsune_miku)..." : ""}
                className="flex-1 min-w-[60px] w-0 bg-transparent text-white placeholder-slate-500 focus:outline-none text-lg py-1"
              />
            </div>
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 z-20">
              {isSearching && (
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              )}
              <button
                type="button"
                onClick={() => setSafeMode(!safeMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium transition-all duration-300 whitespace-nowrap border ${
                  safeMode 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30'
                }`}
                title={safeMode ? "Safe Mode Active" : "NSFW Mode Active"}
              >
                {safeMode ? <Shield className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                <span className="hidden sm:inline text-sm">{safeMode ? 'Safe' : 'NSFW'}</span>
              </button>
              <button 
                type="submit"
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-colors shadow-sm"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </form>

          {/* Dropdown */}
          <AnimatePresence>
            {showDropdown && suggestions.length > 0 && (
              <motion.div
                ref={suggestionsRef}
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full left-0 right-0 mt-3 bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden z-50 max-h-[40vh] sm:max-h-[50vh] overflow-y-auto custom-scrollbar"
              >
                {suggestions.map((tag, index) => {
                  const color = CATEGORY_COLORS[tag.category] || CATEGORY_COLORS[0];
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleSuggestionClick(tag)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full text-left px-5 py-4 border-b border-slate-800/50 last:border-0 flex items-center justify-between group transition-colors ${
                        isSelected ? 'bg-slate-800/80' : 'hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`p-2 rounded-xl ${color.bg} ${color.text} shadow-sm`}>
                          {color.icon}
                        </span>
                        <span className={`font-medium text-lg transition-colors ${
                          isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                        }`}>
                          {tag.name.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-400 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800/50">
                        {tag.post_count.toLocaleString()} posts
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {(canGoBack || canGoForward) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => window.history.forward()}
            disabled={!canGoForward}
            className="hidden sm:flex p-3 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 text-white rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl"
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>
        )}
      </motion.div>

      {/* Main Content */}
      <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 pb-12 pt-32 sm:pt-40 relative z-10">
        <AnimatePresence mode="wait">
          {!selectedTag && !isLoadingDetails ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          ) : isLoadingDetails ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-32"
            >
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
              <p className="text-slate-400 font-medium animate-pulse text-lg">Fetching tag details and images...</p>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
            {/* Left Column: Tag Info & Wiki */}
            <div className="lg:col-span-4 xl:col-span-3 2xl:col-span-3 space-y-6">
              <div className="bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-800">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2 capitalize break-words">
                      {selectedTag.name.replace(/_/g, ' ')}
                    </h2>
                    {wiki?.other_names && wiki.other_names.some(name => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\uFAFF\uFF66-\uFF9F\uAC00-\uD7AF]/.test(name)) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {wiki.other_names.filter(name => /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\uFAFF\uFF66-\uFF9F\uAC00-\uD7AF]/.test(name)).map((name, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded text-sm text-slate-300 border border-slate-700/50">
                            <a href={`https://www.pixiv.net/tags/${encodeURIComponent(name.replace(/_/g, ' '))}/artworks`} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 hover:underline inline-flex items-center gap-1" title="Search on Pixiv">
                              {name.replace(/_/g, ' ')}
                              <ExternalLink className="w-3 h-3 inline" />
                            </a>
                            <button onClick={() => handleCopySingleTag(name)} className="text-slate-500 hover:text-slate-300 ml-1" title="Copy">
                              {copiedTag === name ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${CATEGORY_COLORS[selectedTag.category]?.bg || CATEGORY_COLORS[0].bg} ${CATEGORY_COLORS[selectedTag.category]?.text || CATEGORY_COLORS[0].text}`}>
                        {CATEGORY_COLORS[selectedTag.category]?.icon || CATEGORY_COLORS[0].icon}
                        {CATEGORY_NAMES[selectedTag.category] || 'General'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-slate-800 text-slate-300">
                        <ImageIcon className="w-4 h-4" />
                        {selectedTag.post_count.toLocaleString()} posts
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-400" />
                    {selectedTag.category === 4 ? 'Character Traits & Info' : 'Wiki Information'}
                  </h3>
                  {wiki ? (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <div className="relative">
                        <div className={`whitespace-pre-wrap text-slate-300 leading-relaxed break-words ${!isWikiExpanded && wiki.body && wiki.body.length > 400 ? 'max-h-64 overflow-hidden' : ''}`}>
                          {renderDText(wiki.body, handleTagClick) || 'No detailed description available for this tag.'}
                        </div>
                        {!isWikiExpanded && wiki.body && wiki.body.length > 400 && (
                          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
                        )}
                      </div>
                      {wiki.body && wiki.body.length > 400 && (
                        <button
                          onClick={() => setIsWikiExpanded(!isWikiExpanded)}
                          className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors focus:outline-none inline-flex items-center gap-1"
                        >
                          {isWikiExpanded ? 'Show Less' : 'Read More'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-sm">No wiki page exists for this tag.</p>
                  )}
                </div>

                {selectedTag.related_tags && (
                  <div className="mt-6 pt-6 border-t border-slate-800">
                    <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <TagIcon className="w-4 h-4 text-indigo-400" />
                      Related Tags (See Also)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {parseRelatedTags(selectedTag.related_tags).slice(0, 15).map((t, i) => (
                        <button
                          key={i}
                          onClick={() => handleTagClick(t.tag)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors border border-slate-700/50"
                        >
                          {formatTag(t.tag)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Image Gallery */}
            <div className="lg:col-span-8 xl:col-span-9 2xl:col-span-9">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-indigo-400" />
                  Post
                </h3>
                <span className="text-sm text-slate-400">Showing recent {posts.length} posts</span>
              </div>

              {posts.length > 0 ? (
                <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-3 xl:columns-4 2xl:columns-5 gap-4 space-y-4">
                  {posts.map((post) => (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={post.id}
                      className="break-inside-avoid relative group rounded-xl overflow-hidden bg-slate-800 border border-slate-700"
                    >
                      <div 
                        onClick={() => setSelectedImagePost(post)}
                        className="block w-full h-full text-left cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedImagePost(post);
                          }
                        }}
                      >
                        {/* Download Original Button */}
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDownload(post);
                          }}
                          disabled={downloadingIds.has(post.id)}
                          className="absolute top-2 left-2 z-20 p-2 bg-black/60 backdrop-blur-md text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-indigo-600 border border-white/10 shadow-lg disabled:opacity-100 disabled:bg-indigo-600"
                          title="Download Original"
                        >
                          {downloadingIds.has(post.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>

                        {/* Downloading Overlay */}
                        <AnimatePresence>
                          {downloadingIds.has(post.id) && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
                            >
                              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
                              <span className="text-white font-medium text-sm">Downloading...</span>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {isVideo(post.file_ext) && !post.preview_file_url ? (
                          <video
                            src={post.large_file_url || post.file_url}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <img
                            src={post.preview_file_url || post.large_file_url || post.file_url}
                            alt={`Post ${post.id}`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        )}
                        {(isVideo(post.file_ext) || post.file_ext === 'gif') && (
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md p-1.5 rounded-full text-white shadow-sm border border-white/10 z-10 pointer-events-none">
                            <Play className="w-4 h-4 fill-white" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                          <div className="flex items-center justify-between text-white">
                            <span className="text-xs font-medium bg-black/60 px-2 py-1 rounded-md backdrop-blur-sm">
                              Score: {post.score}
                            </span>
                            <span className="text-xs font-medium bg-black/60 px-2 py-1 rounded-md backdrop-blur-sm uppercase">
                              {post.rating === 's' || post.rating === 'g' ? 'Safe' : 'NSFW'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-900 rounded-2xl p-12 text-center border border-slate-800">
                  <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-1">No images found</h3>
                  <p className="text-slate-400">
                    {safeMode 
                      ? "There are no safe images for this tag. Try turning off Safe Mode." 
                      : "No images are available for this tag."}
                  </p>
                </div>
              )}

              {/* Pagination Controls - Show if we have a tag and (we have posts OR we are past page 1 OR there are more pages) */}
              {(posts.length > 0 || currentPage > 1 || hasMore) && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center gap-3 bg-slate-900/90 backdrop-blur-xl p-2 rounded-2xl border border-slate-700/50 shadow-2xl">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2.5 bg-slate-800 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors shadow-sm"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-slate-400 text-sm font-medium">Page</span>
                    <input
                      type="text"
                      value={pageInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d+$/.test(val)) {
                          setPageInput(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const newPage = parseInt(pageInput);
                          if (!isNaN(newPage) && newPage > 0) {
                            handlePageChange(newPage);
                          } else {
                            setPageInput(currentPage.toString());
                          }
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onBlur={() => setPageInput(currentPage.toString())}
                      className="w-12 py-1 bg-slate-800 border border-slate-700 text-white text-center rounded-lg focus:outline-none focus:border-indigo-500 transition-colors font-mono text-sm"
                    />
                    {maxPages > 0 && (
                      <span className="text-slate-400 text-sm font-medium">
                        of {maxPages}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!hasMore}
                    className="p-2.5 bg-slate-800 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors shadow-sm"
                    title="Next Page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Image Details Modal */}
      <AnimatePresence>
        {selectedImagePost && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" 
            onClick={() => setSelectedImagePost(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-2xl border border-slate-700" 
              onClick={e => e.stopPropagation()}
            >
              {/* Left: Image */}
              <div className="w-full md:w-2/3 bg-black flex items-center justify-center p-4 relative group">
                {posts.findIndex(p => p.id === selectedImagePost.id) > 0 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentIndex = posts.findIndex(p => p.id === selectedImagePost.id);
                      setSelectedImagePost(posts[currentIndex - 1]);
                    }} 
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors z-10"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}
                {isVideo(selectedImagePost.file_ext) ? (
                  <CustomVideoPlayer
                    src={selectedImagePost.large_file_url || selectedImagePost.file_url}
                    className="max-w-full max-h-[40vh] md:max-h-[85vh] object-contain cursor-pointer"
                  />
                ) : (
                  <ZoomableImage
                    src={selectedImagePost.large_file_url || selectedImagePost.file_url || selectedImagePost.preview_file_url || ''} 
                    alt={`Post ${selectedImagePost.id}`}
                    className="w-full h-[40vh] md:h-[85vh]"
                  />
                )}
                {posts.findIndex(p => p.id === selectedImagePost.id) < posts.length - 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentIndex = posts.findIndex(p => p.id === selectedImagePost.id);
                      setSelectedImagePost(posts[currentIndex + 1]);
                    }} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors z-10"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>
              
              {/* Right: Tags */}
              <div className="w-full md:w-1/3 p-6 flex flex-col max-h-[50vh] md:max-h-[90vh]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <TagIcon className="w-5 h-5 text-indigo-400" />
                    Post Tags
                  </h3>
                  <button onClick={() => setSelectedImagePost(null)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex items-center justify-between mb-4 bg-slate-800 p-3 rounded-xl border border-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-300 select-none">
                    <input 
                      type="checkbox" 
                      checked={showUnderscores} 
                      onChange={(e) => setShowUnderscores(e.target.checked)}
                      className="rounded border-slate-600 text-indigo-500 focus:ring-indigo-500/50 bg-slate-700 w-4 h-4 cursor-pointer"
                    />
                    Show Underscores
                  </label>
                  
                  <button 
                    onClick={() => handleCopyAllTags(selectedImagePost)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    {copiedAll ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedAll ? 'Copied!' : 'Copy Tags'}
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 pb-4 custom-scrollbar">
                  <div className="flex flex-wrap gap-2">
                    {getOrderedTagsWithCategory(selectedImagePost).map((t, i) => {
                      const color = CATEGORY_COLORS[t.category] || CATEGORY_COLORS[0];
                      const isCopied = copiedTag === t.tag;
                      return (
                        <button 
                          key={i} 
                          onClick={() => handleCopySingleTag(t.tag)}
                          className={`px-2.5 py-1 border rounded-md text-sm hover:opacity-80 transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                            isCopied 
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' 
                              : `${color.bg} border-transparent ${color.text}`
                          }`}
                          title="Click to copy"
                        >
                          <AnimatePresence>
                            {isCopied && (
                              <motion.span
                                initial={{ scale: 0, width: 0, opacity: 0 }}
                                animate={{ scale: 1, width: 'auto', opacity: 1 }}
                                exit={{ scale: 0, width: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center justify-center"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <span>{formatTag(t.tag)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-800 shrink-0 flex flex-col gap-2">
                  <button
                    onClick={() => handleDownload(selectedImagePost)}
                    disabled={downloadingIds.has(selectedImagePost.id)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                  >
                    {downloadingIds.has(selectedImagePost.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {downloadingIds.has(selectedImagePost.id) ? 'Downloading...' : 'Download Original'}
                  </button>
                  <a 
                    href={`https://danbooru.donmai.us/posts/${selectedImagePost.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors border border-slate-700"
                  >
                    View Original on Danbooru
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <ChatMenu />
    </div>
  );
}
