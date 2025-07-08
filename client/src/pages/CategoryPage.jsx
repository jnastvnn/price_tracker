
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const categories = [
  {
  "id": 1,
  "name": "Electronics and Appliances",
  "slug": "electronics-and-appliances",
  "parent_id": null,
  "level": 0
}, {
  "id": 2,
  "name": "Small Home Appliances",
  "slug": "small-home-appliances",
  "parent_id": 1,
  "level": 1
}, {
  "id": 3,
  "name": "Coffee Makers",
  "slug": "coffee-makers",
  "parent_id": 2,
  "level": 2
}, {
  "id": 4,
  "name": "Toasters",
  "slug": "toasters",
  "parent_id": 2,
  "level": 2
}, {
  "id": 5,
  "name": "Food Processors and Mixers",
  "slug": "food-processors-and-mixers",
  "parent_id": 2,
  "level": 2
}, {
  "id": 6,
  "name": "Muut kodin pienkoneet",
  "slug": "muut-kodin-pienkoneet",
  "parent_id": 2,
  "level": 2
}, {
  "id": 7,
  "name": "Vacuum Cleaners",
  "slug": "vacuum-cleaners",
  "parent_id": 2,
  "level": 2
}, {
  "id": 8,
  "name": "Hand Blenders and Electric Mixers",
  "slug": "hand-blenders-and-electric-mixers",
  "parent_id": 2,
  "level": 2
}, {
  "id": 9,
  "name": "Irons",
  "slug": "irons",
  "parent_id": 2,
  "level": 2
}, {
  "id": 10,
  "name": "Blenders",
  "slug": "blenders",
  "parent_id": 2,
  "level": 2
}, {
  "id": 11,
  "name": "Kettles",
  "slug": "kettles",
  "parent_id": 2,
  "level": 2
}, {
  "id": 12,
  "name": "Waffle Irons and Sandwich Grills",
  "slug": "waffle-irons-and-sandwich-grills",
  "parent_id": 2,
  "level": 2
}, {
  "id": 13,
  "name": "Home Appliances",
  "slug": "home-appliances",
  "parent_id": 1,
  "level": 1
}, {
  "id": 14,
  "name": "Dishwashers",
  "slug": "dishwashers",
  "parent_id": 13,
  "level": 2
}, {
  "id": 15,
  "name": "Refrigerators",
  "slug": "refrigerators",
  "parent_id": 13,
  "level": 2
}, {
  "id": 16,
  "name": "Hobs",
  "slug": "hobs",
  "parent_id": 13,
  "level": 2
}, {
  "id": 17,
  "name": "Dryers and Drying Cabinets",
  "slug": "dryers-and-drying-cabinets",
  "parent_id": 13,
  "level": 2
}, {
  "id": 18,
  "name": "Stoves",
  "slug": "stoves",
  "parent_id": 13,
  "level": 2
}, {
  "id": 19,
  "name": "Extractor Hoods",
  "slug": "extractor-hoods",
  "parent_id": 13,
  "level": 2
}, {
  "id": 20,
  "name": "Microwave Ovens",
  "slug": "microwave-ovens",
  "parent_id": 13,
  "level": 2
}, {
  "id": 21,
  "name": "Other Home Appliances",
  "slug": "other-home-appliances",
  "parent_id": 13,
  "level": 2
}, {
  "id": 22,
  "name": "Freezers",
  "slug": "freezers",
  "parent_id": 13,
  "level": 2
}, {
  "id": 23,
  "name": "Washing Machines",
  "slug": "washing-machines",
  "parent_id": 13,
  "level": 2
}, {
  "id": 24,
  "name": "Ovens",
  "slug": "ovens",
  "parent_id": 13,
  "level": 2
}, {
  "id": 25,
  "name": "Other Electronics and Appliances",
  "slug": "other-electronics-and-appliances",
  "parent_id": 1,
  "level": 1
}, {
  "id": 26,
  "name": "Phones and Accessories",
  "slug": "phones-and-accessories",
  "parent_id": 1,
  "level": 1
}, {
  "id": 27,
  "name": "Mobile Phones",
  "slug": "mobile-phones",
  "parent_id": 26,
  "level": 2
}, {
  "id": 28,
  "name": "Other Phones",
  "slug": "other-phones",
  "parent_id": 26,
  "level": 2
}, {
  "id": 29,
  "name": "Phone Accessories",
  "slug": "phone-accessories",
  "parent_id": 26,
  "level": 2
}, {
  "id": 30,
  "name": "Health and Well-being",
  "slug": "health-and-well-being",
  "parent_id": 1,
  "level": 1
}, {
  "id": 31,
  "name": "Information Technology",
  "slug": "information-technology",
  "parent_id": 1,
  "level": 1
}, {
  "id": 32,
  "name": "Laptops",
  "slug": "laptops",
  "parent_id": 31,
  "level": 2
}, {
  "id": 33,
  "name": "Hard Drives and Storage",
  "slug": "hard-drives-and-storage",
  "parent_id": 31,
  "level": 2
}, {
  "id": 34,
  "name": "Calculators",
  "slug": "calculators",
  "parent_id": 31,
  "level": 2
}, {
  "id": 35,
  "name": "Monitors",
  "slug": "monitors",
  "parent_id": 31,
  "level": 2
}, {
  "id": 36,
  "name": "Peripherals",
  "slug": "peripherals",
  "parent_id": 31,
  "level": 2
}, {
  "id": 37,
  "name": "Software",
  "slug": "software",
  "parent_id": 31,
  "level": 2
}, {
  "id": 38,
  "name": "Desktop Computers",
  "slug": "desktop-computers",
  "parent_id": 31,
  "level": 2
}, {
  "id": 39,
  "name": "Tablets and E-readers",
  "slug": "tablets-and-e-readers",
  "parent_id": 31,
  "level": 2
}, {
  "id": 40,
  "name": "Computer Components",
  "slug": "computer-components",
  "parent_id": 31,
  "level": 2
}, {
  "id": 41,
  "name": "Networking Equipment",
  "slug": "networking-equipment",
  "parent_id": 31,
  "level": 2
}, {
  "id": 42,
  "name": "Photography and Video",
  "slug": "photography-and-video",
  "parent_id": 1,
  "level": 1
}, {
  "id": 43,
  "name": "Hybrid Cameras",
  "slug": "hybrid-cameras",
  "parent_id": 42,
  "level": 2
}, {
  "id": 44,
  "name": "System Cameras",
  "slug": "system-cameras",
  "parent_id": 42,
  "level": 2
}, {
  "id": 45,
  "name": "Camera Bags",
  "slug": "camera-bags",
  "parent_id": 42,
  "level": 2
}, {
  "id": 46,
  "name": "Compact Cameras",
  "slug": "compact-cameras",
  "parent_id": 42,
  "level": 2
}, {
  "id": 47,
  "name": "Other Photography Accessories",
  "slug": "other-photography-accessories",
  "parent_id": 42,
  "level": 2
}, {
  "id": 48,
  "name": "Lenses",
  "slug": "lenses",
  "parent_id": 42,
  "level": 2
}, {
  "id": 49,
  "name": "Camcorders",
  "slug": "camcorders",
  "parent_id": 42,
  "level": 2
}, {
  "id": 50,
  "name": "Video Games and Consoles",
  "slug": "video-games-and-consoles",
  "parent_id": 1,
  "level": 1
}, {
  "id": 51,
  "name": "Merchandise",
  "slug": "merchandise",
  "parent_id": 50,
  "level": 2
}, {
  "id": 52,
  "name": "Game Consoles",
  "slug": "game-consoles",
  "parent_id": 50,
  "level": 2
}, {
  "id": 53,
  "name": "Games",
  "slug": "games",
  "parent_id": 50,
  "level": 2
}, {
  "id": 54,
  "name": "Audio and Video",
  "slug": "audio-and-video",
  "parent_id": 1,
  "level": 1
}, {
  "id": 55,
  "name": "Blu-ray Players",
  "slug": "blu-ray-players",
  "parent_id": 54,
  "level": 2
}, {
  "id": 56,
  "name": "DVD Players",
  "slug": "dvd-players",
  "parent_id": 54,
  "level": 2
}, {
  "id": 57,
  "name": "Cables and Peripherals",
  "slug": "cables-and-peripherals",
  "parent_id": 54,
  "level": 2
}, {
  "id": 58,
  "name": "Speakers",
  "slug": "speakers",
  "parent_id": 54,
  "level": 2
}, {
  "id": 59,
  "name": "Home Theater Systems",
  "slug": "home-theater-systems",
  "parent_id": 54,
  "level": 2
}, {
  "id": 60,
  "name": "Headphones",
  "slug": "headphones",
  "parent_id": 54,
  "level": 2
}, {
  "id": 61,
  "name": "MP3 Players and Portable Audio",
  "slug": "mp3-players-and-portable-audio",
  "parent_id": 54,
  "level": 2
}, {
  "id": 62,
  "name": "Media Players and Set-top Boxes",
  "slug": "media-players-and-set-top-boxes",
  "parent_id": 54,
  "level": 2
}, {
  "id": 63,
  "name": "PA Equipment",
  "slug": "pa-equipment",
  "parent_id": 54,
  "level": 2
}, {
  "id": 64,
  "name": "Radios",
  "slug": "radios",
  "parent_id": 54,
  "level": 2
}, {
  "id": 65,
  "name": "Stereos",
  "slug": "stereos",
  "parent_id": 54,
  "level": 2
}, {
  "id": 66,
  "name": "TV",
  "slug": "tv",
  "parent_id": 54,
  "level": 2
}, {
  "id": 67,
  "name": "Amplifiers and Receivers",
  "slug": "amplifiers-and-receivers",
  "parent_id": 54,
  "level": 2
}, {
  "id": 68,
  "name": "VCRs",
  "slug": "vcrs",
  "parent_id": 54,
  "level": 2
}, {
  "id": 69,
  "name": "Projectors and Screens",
  "slug": "projectors-and-screens",
  "parent_id": 54,
  "level": 2
}];

// Build category tree structure
const buildCategoryTree = (categories) => {
  const categoryMap = {};
  const tree = [];

  // Create a map for quick lookup
  categories.forEach(category => {
    categoryMap[category.id] = { ...category, children: [] };
  });

  // Build the tree
  categories.forEach(category => {
    if (category.parent_id === null) {
      tree.push(categoryMap[category.id]);
    } else {
      const parent = categoryMap[category.parent_id];
      if (parent) {
        parent.children.push(categoryMap[category.id]);
      }
    }
  });

  return tree;
};

// Individual category tree node component
const CategoryTreeNode = ({ category, level = 0, expandedNodes, toggleNode, navigate }) => {
  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expandedNodes.has(category.id);
  const indentStyle = { paddingLeft: `${level * 20}px` };

  const handleClick = (e) => {
    e.preventDefault();
    if (hasChildren) {
      toggleNode(category.id);
    } else {
      // Navigate to category page for leaf nodes
      navigate(`/category/${category.id}`);
    }
  };

  const handleCategoryLinkClick = (e) => {
    e.stopPropagation();
    navigate(`/category/${category.id}`);
  };

  return (
    <div className="category-tree-node">
      <div 
        className={`category-item level-${level} ${hasChildren ? 'has-children' : 'leaf'} ${isExpanded ? 'expanded' : ''}`}
        style={indentStyle}
        onClick={handleClick}
      >
        {hasChildren && (
          <span className="expand-icon">
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && (
          <span className="leaf-icon">•</span>
        )}
        <span 
          className="category-name"
          onClick={hasChildren ? undefined : handleCategoryLinkClick}
        >
          {category.name}
        </span>
        {hasChildren && (
          <span className="child-count">({category.children.length})</span>
        )}
        {hasChildren && (
          <button 
            className="browse-button"
            onClick={handleCategoryLinkClick}
            title={`Browse ${category.name}`}
          >
            Browse
          </button>
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div className="category-children">
          {category.children.map(child => (
            <CategoryTreeNode
              key={child.id}
              category={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CategoryPage = () => {
  const navigate = useNavigate();
  const [expandedNodes, setExpandedNodes] = useState(new Set());


  const categoryTree = buildCategoryTree(categories);

  const toggleNode = (categoryId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedNodes(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set(categories.filter(cat => cat.children?.length > 0 || categories.some(c => c.parent_id === cat.id)).map(cat => cat.id));
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const filteredTree = categoryTree;

  return (
    <div className="category-page">
      <div className="page-header">
        <div className="header-left">
          <button 
            onClick={() => navigate(-1)} 
            className="back-button"
            title="Go back"
          >
            ← Back
          </button>
          <h1>All Categories</h1>
        </div>
        <div className="page-controls">
          <div className="tree-controls">
            <button onClick={expandAll} className="control-button">
              Expand All
            </button>
            <button onClick={collapseAll} className="control-button">
              Collapse All
            </button>
          </div>
        </div>
      </div>

      <div className="category-tree">
        <div className="tree-container">
          {categoryTree.map(category => (
            <CategoryTreeNode
              key={category.id}
              category={category}
              level={0}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              navigate={navigate}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        .category-page {
          padding: 1rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .back-button {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.9rem;
          color: #555;
        }

        .back-button:hover {
          background-color: #f5f5f5;
          border-color: #bbb;
        }

        .page-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }



        .tree-controls {
          display: flex;
          gap: 0.5rem;
        }

        .control-button {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .control-button:hover {
          background-color: #f5f5f5;
        }

        .category-item {
          display: flex;
          align-items: center;
          padding: 0.5rem;
          cursor: pointer;
          border-radius: 4px;
          transition: background-color 0.2s;
          gap: 0.5rem;
        }

        .category-item:hover {
          background-color: #f5f5f5;
        }

        .category-item.has-children {
          font-weight: 500;
        }

        .category-item.level-0 {
          font-size: 1.1rem;
          font-weight: bold;
          color: #2c3e50;
        }

        .category-item.level-1 {
          color: #34495e;
        }

        .category-item.level-2 {
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        .expand-icon {
          width: 16px;
          text-align: center;
          font-size: 0.8rem;
          color: #666;
        }

        .leaf-icon {
          width: 16px;
          text-align: center;
          color: #bdc3c7;
        }

        .category-name {
          flex: 1;
        }

        .child-count {
          font-size: 0.8rem;
          color: #95a5a6;
          margin-left: 0.5rem;
        }

        .browse-button {
          padding: 0.25rem 0.5rem;
          font-size: 0.8rem;
          border: 1px solid #3498db;
          background: white;
          color: #3498db;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .browse-button:hover {
          background: #3498db;
          color: white;
        }



        .tree-container {
          border: 1px solid #eee;
          border-radius: 8px;
          overflow: hidden;
        }

        .category-tree-node {
          border-bottom: 1px solid #f8f9fa;
        }

        .category-tree-node:last-child {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
}; 
