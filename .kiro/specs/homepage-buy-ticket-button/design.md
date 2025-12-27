# Design Document

## Overview

本设计文档描述了如何在首页（StatsPanel组件）的hero区域添加一个购买门票按钮，该按钮将提供直接跳转到挖矿页面的快捷方式，提升用户转化率和使用体验。

## Architecture

### Component Structure
```
StatsPanel (首页组件)
├── Hero Section (英雄区域)
│   ├── Protocol Badge (协议标识)
│   ├── Title & Subtitle (标题和副标题)
│   ├── Description (描述文本)
│   └── Action Buttons Container (操作按钮容器)
│       ├── Join Now Button (现有的立即参与按钮)
│       ├── Buy Ticket Button (新增的购买门票按钮) ← 新增
│       └── Whitepaper Button (白皮书按钮)
```

### Navigation Flow
```
Homepage → Buy Ticket Button Click → Mining Page (AppTab.MINING)
```

## Components and Interfaces

### 1. StatsPanel Component Updates

**Props Interface (无变化):**
```typescript
interface StatsPanelProps {
  stats: UserStats
  onJoinClick: () => void
  onWhitepaperClick: () => void
}
```

**New Handler Function:**
```typescript
const handleBuyTicketClick = () => {
  onJoinClick() // 复用现有的跳转逻辑
}
```

### 2. Button Component Design

**Button Specifications:**
- **Type**: Primary action button
- **Style**: Gradient background with neon colors
- **Size**: Medium (与现有按钮保持一致)
- **Icon**: Ticket icon (from lucide-react)
- **Position**: Between "Join Now" and "Whitepaper" buttons

## Data Models

### Translation Keys (需要添加到translations.ts)

```typescript
interface TranslationKeys {
  stats: {
    // ... existing keys
    buyTicket: string // 新增：购买门票按钮文本
  }
}
```

**Translation Values:**
```typescript
const translations = {
  zh: {
    stats: {
      buyTicket: "购买门票"
    }
  },
  en: {
    stats: {
      buyTicket: "Buy Ticket"
    }
  },
  "zh-TW": {
    stats: {
      buyTicket: "購買門票"
    }
  },
  ja: {
    stats: {
      buyTicket: "チケット購入"
    }
  },
  ko: {
    stats: {
      buyTicket: "티켓 구매"
    }
  },
  ar: {
    stats: {
      buyTicket: "شراء تذكرة"
    }
  },
  ru: {
    stats: {
      buyTicket: "Купить билет"
    }
  },
  es: {
    stats: {
      buyTicket: "Comprar Ticket"
    }
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Button Rendering
*For any* valid StatsPanel component render, the buy ticket button should be visible in the hero section alongside other action buttons
**Validates: Requirements 1.1**

### Property 2: Navigation Behavior
*For any* buy ticket button click event, the application should navigate to the mining tab (AppTab.MINING)
**Validates: Requirements 1.2**

### Property 3: Responsive Design
*For any* screen size (mobile, tablet, desktop), the buy ticket button should maintain proper spacing and alignment with other buttons
**Validates: Requirements 1.4, 2.4**

### Property 4: Multi-language Support
*For any* supported language selection, the buy ticket button should display the correct translated text
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Visual Consistency
*For any* button state (normal, hover, active), the buy ticket button should provide appropriate visual feedback and maintain brand consistency
**Validates: Requirements 2.1, 2.2, 5.2**

## Error Handling

### Potential Issues and Solutions

1. **Translation Missing**: 
   - Fallback to English text if translation key is missing
   - Log warning for missing translations

2. **Navigation Failure**:
   - Button click should always trigger navigation
   - No error states needed as navigation is handled by parent component

3. **Responsive Layout Issues**:
   - Use CSS Grid/Flexbox for consistent button layout
   - Test on multiple screen sizes

## Testing Strategy

### Unit Tests
- Test button rendering with different language settings
- Test click handler invocation
- Test responsive layout at different breakpoints
- Test accessibility attributes (ARIA labels, keyboard navigation)

### Property-Based Tests
- **Property 1**: Button visibility across all component states
- **Property 2**: Navigation consistency across all user interactions
- **Property 3**: Layout stability across all screen sizes
- **Property 4**: Translation accuracy across all supported languages
- **Property 5**: Visual feedback consistency across all interaction states

### Integration Tests
- Test complete user flow: Homepage → Buy Ticket → Mining Page
- Test button behavior with different user states (connected/disconnected wallet)
- Test multi-language switching with button text updates

## Implementation Notes

### CSS Classes and Styling
```css
.buy-ticket-button {
  @apply px-5 py-2.5 md:px-6 md:py-3;
  @apply bg-gradient-to-r from-neon-500 to-neon-600;
  @apply hover:from-neon-400 hover:to-neon-500;
  @apply text-black font-bold rounded-lg;
  @apply shadow-xl transition-all transform hover:-translate-y-1;
  @apply text-sm md:text-base;
  @apply flex items-center gap-2;
}
```

### Button Layout Structure
```jsx
<div className="flex flex-col sm:flex-row gap-3 md:gap-4">
  <button onClick={onJoinClick} className="join-button">
    {t.stats.join}
  </button>
  <button onClick={handleBuyTicketClick} className="buy-ticket-button">
    <Ticket size={16} />
    {t.stats.buyTicket}
  </button>
  <button onClick={onWhitepaperClick} className="whitepaper-button">
    {t.stats.whitepaper}
  </button>
</div>
```

### Performance Considerations
- Button rendering should not cause layout shifts
- Icon should be loaded efficiently (using lucide-react)
- Hover effects should be smooth (60fps)
- Click response should be immediate (<100ms)

### Accessibility Features
- Proper ARIA labels for screen readers
- Keyboard navigation support (Tab key)
- Focus indicators for keyboard users
- Sufficient color contrast for text readability