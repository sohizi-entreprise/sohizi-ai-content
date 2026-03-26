import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CharacterHeaderComponent, EntityHeaderComponent } from "../components/entity-header";

export const CharacterHeaderExtension = Node.create({
    name: 'characterHeader',
    group: 'block',
    marks: '',
    atom: true,

    addAttributes() {
      return {
        name: {
            default: '',
            parseHTML: (element) => element.getAttribute('data-name'),
            renderHTML: (attributes) => {
                if (!attributes.name) return {}
                return { 'data-name': attributes.name }
            },
        },
        role: {
            default: '',
            parseHTML: (element) => element.getAttribute('data-role'),
            renderHTML: (attributes) => {
                if (!attributes.role) return {}
                return { 'data-role': attributes.role }
            },
        },
        age: {
            default: '',
            parseHTML: (element) => element.getAttribute('data-age'),
            renderHTML: (attributes) => {
                if (!attributes.age) return {}
                return { 'data-age': attributes.age }
            },
        },
        thumbnail: {
            default: '',
            parseHTML: (element) => element.getAttribute('data-thumbnail'),
            renderHTML: (attributes) => {
                if (!attributes.thumbnail) return {}
                return { 'data-thumbnail': attributes.thumbnail }
            },
        },
      }
    },

    parseHTML() {
      return [{ tag: 'div[data-type="character-header"]' }]
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          'data-type': 'character-header',
        }),
        0,
      ]
    },
    
    
    addNodeView(){
        return ReactNodeViewRenderer(CharacterHeaderComponent)
    }
    
})

export const EntityHeaderExtension = Node.create({
    name: 'entityHeader',
    group: 'block',
    marks: '',
    atom: true,
    addAttributes() {
      return {
        name: {
            default: '',
            parseHTML: (element) => element.getAttribute('data-name'),
            renderHTML: (attributes) => {
                if (!attributes.name) return {}
                return { 'data-name': attributes.name }
            },
        },
        thumbnail: {
            default: '',
            parseHTML: (element) => element.getAttribute('data-thumbnail'),
            renderHTML: (attributes) => {
                if (!attributes.thumbnail) return {}
                return { 'data-thumbnail': attributes.thumbnail }
            },
        },
        entityType: {
            default: '',
            parseHTML: (element) => element.getAttribute('data-entity-type'),
            renderHTML: (attributes) => {
                if (!attributes.entityType) return {}
                return { 'data-entity-type': attributes.entityType }
            },
        },
      }
    },
    
    parseHTML() {
      return [{ tag: 'div[data-type="entity-header"]' }]
    },
    
    renderHTML({ HTMLAttributes }) {
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          'data-type': 'entity-header',
        }),
        0,
      ]
    },
    addNodeView(){
        return ReactNodeViewRenderer(EntityHeaderComponent)
    }

})