import { mount } from 'enzyme';
import * as React from 'react';
import { UIRouter, UIView, TransitionPropCollisionError } from '../../components';
import { ReactStateDeclaration } from '../../interface';

import { makeTestRouter, muteConsoleErrors } from '../../__tests__/util';

const states: ReactStateDeclaration[] = [
  {
    name: 'parent',
    component: () => (
      <div>
        <span>parent</span>
        <UIView />
      </div>
    ),
  },
  {
    name: 'parent.child',
    component: () => <span>child</span>,
  },
  {
    name: 'namedParent',
    component: () => (
      <div>
        <span>namedParent</span>
        <UIView name="child1" />
        <UIView name="child2" />
      </div>
    ),
  },
  {
    name: 'namedParent.namedChild',
    views: {
      child1: (() => <span>child1</span>) as any,
      child2: { component: () => <span>child2</span> },
    },
  },
  {
    name: 'withrenderprop',
    component: ({ foo }) => (
      <div>
        <span>withrenderprop</span>
        {foo}
      </div>
    ),
  },
];

describe('<UIView>', () => {
  describe('(unmounted)', () => {
    let { router, routerGo, mountInRouter } = makeTestRouter([]);
    beforeEach(() => ({ router, routerGo, mountInRouter } = makeTestRouter(states)));

    it('renders an empty <div>', () => {
      const wrapper = mountInRouter(<UIView />);
      expect(wrapper.html()).toBe('<div></div>');
    });

    it('renders its child if provided', () => {
      expect(
        mountInRouter(
          <UIView>
            <span />
          </UIView>
        ).contains(<span />)
      ).toBe(true);
    });

    it('injects props correctly', () => {
      expect(
        mountInRouter(
          <UIView className="myClass" style={{ margin: 5 }}>
            <span />
          </UIView>
        ).contains(<span className="myClass" style={{ margin: 5 }} />)
      ).toBe(true);
    });
  });

  describe('(mounted)', () => {
    let { router, routerGo, mountInRouter } = makeTestRouter([]);
    beforeEach(() => ({ router, routerGo, mountInRouter } = makeTestRouter(states)));
    it('renders its State Component', async () => {
      const wrapper = mountInRouter(<UIView />);
      await routerGo('parent');
      expect(wrapper.update().html()).toEqual(`<div><span>parent</span><div></div></div>`);
    });

    it('injects the right props', async () => {
      const Comp = () => <span>component</span>;
      router.stateRegistry.register({
        name: '__state',
        component: Comp,
        resolve: [{ resolveFn: () => true, token: 'myresolve' }],
      } as ReactStateDeclaration);

      const wrapper = mountInRouter(<UIView />);
      await routerGo('__state');
      wrapper.update();
      // @ts-ignore
      expect(wrapper.find(Comp).props().myresolve).not.toBeUndefined();
      // @ts-ignore
      expect(wrapper.find(Comp).props().transition).not.toBeUndefined();
    });

    it('injects custom resolves', async () => {
      const Comp = () => <span>component</span>;
      router.stateRegistry.register({
        name: '__state',
        component: Comp,
        resolve: [{ token: 'foo', resolveFn: () => 'bar' }],
      } as ReactStateDeclaration);

      const wrapper = mountInRouter(<UIView />);
      await routerGo('__state');
      wrapper.update();
      // @ts-ignore
      expect(wrapper.find(Comp).props().foo).toBe('bar');
    });

    it('throws if a resolve uses the token `transition`', async () => {
      const Comp = () => <span>component</span>;
      router.stateRegistry.register({
        name: '__state',
        component: Comp,
        resolve: [{ token: 'transition', resolveFn: () => null }],
      } as ReactStateDeclaration);

      await routerGo('__state');

      muteConsoleErrors();
      expect(() => mountInRouter(<UIView />)).toThrow(TransitionPropCollisionError);
    });

    it('renders nested State Components', async () => {
      await routerGo('parent.child');
      const wrapper = mountInRouter(<UIView />);
      expect(wrapper.html()).toEqual(`<div><span>parent</span><span>child</span></div>`);
    });

    it('renders multiple nested unmounted <UIView>', async () => {
      await routerGo('namedParent');
      const wrapper = mountInRouter(<UIView />);
      expect(wrapper.html()).toEqual(`<div><span>namedParent</span><div></div><div></div></div>`);
    });

    it('renders multiple nested mounted <UIView>', async () => {
      await routerGo('namedParent.namedChild');
      const wrapper = mountInRouter(<UIView />);
      expect(wrapper.html()).toEqual(`<div><span>namedParent</span><span>child1</span><span>child2</span></div>`);
    });

    it('unmounts State Component when changing state', async () => {
      const wrapper = mountInRouter(<UIView />);
      await routerGo('parent.child');
      expect(wrapper.update().html()).toEqual(`<div><span>parent</span><span>child</span></div>`);
      await routerGo('parent');
      expect(wrapper.update().html()).toEqual(`<div><span>parent</span><div></div></div>`);
    });

    describe('uiCanExit', () => {
      function makeSpyComponent(uiCanExitSpy) {
        return class Comp extends React.Component<any, any> {
          uiCanExit() {
            return uiCanExitSpy();
          }
          render() {
            return <span>UiCanExitHookComponent</span>;
          }
        };
      }

      it('calls uiCanExit function of its State Component when unmounting', async () => {
        const uiCanExitSpy = jest.fn();

        router.stateRegistry.register({ name: '__state', component: makeSpyComponent(uiCanExitSpy) } as any);
        const wrapper = mountInRouter(<UIView />);

        await routerGo('__state');
        expect(wrapper.update().html()).toEqual('<span>UiCanExitHookComponent</span>');

        await routerGo('parent');
        expect(wrapper.update().html()).toContain('parent');
        expect(uiCanExitSpy).toBeCalled();
      });

      it('calls uiCanExit function of a React.forwardRef() State Component when unmounting', async () => {
        const uiCanExitSpy = jest.fn();
        const Comp = makeSpyComponent(uiCanExitSpy);
        const ForwardRef = React.forwardRef((props, ref: any) => <Comp {...props} ref={ref} />);
        router.stateRegistry.register({ name: '__state', component: ForwardRef } as ReactStateDeclaration);
        const wrapper = mountInRouter(<UIView />);

        await routerGo('__state');
        expect(wrapper.update().html()).toEqual('<span>UiCanExitHookComponent</span>');

        await routerGo('parent');
        expect(wrapper.update().html()).toContain('parent');
        expect(uiCanExitSpy).toBeCalled();
      });

      it('does not transition if uiCanExit function of its State Component returns false', async () => {
        let uiCanExitSpy = jest.fn().mockImplementation(() => false);
        router.stateRegistry.register({ name: '__state', component: makeSpyComponent(uiCanExitSpy) } as any);
        const wrapper = mountInRouter(<UIView />);

        await routerGo('__state');
        expect(wrapper.update().html()).toEqual('<span>UiCanExitHookComponent</span>');

        try {
          await routerGo('parent');
        } catch (error) {}
        expect(wrapper.update().html()).toEqual('<span>UiCanExitHookComponent</span>');
        expect(uiCanExitSpy).toBeCalled();
      });
    });

    it('deregisters the UIView when unmounted', () => {
      const Component = props => <UIRouter router={router}>{props.show ? <UIView /> : <div />}</UIRouter>;
      const wrapper = mount(<Component show={true} />);
      const UIViewInstance = wrapper
        .find(UIView)
        .at(0)
        .find('View')
        .at(0)
        .instance();
      // @ts-ignore
      const deregisterSpy = jest.spyOn(UIViewInstance, 'deregister');
      wrapper.setProps({ show: false });
      expect(deregisterSpy).toHaveBeenCalled();
    });

    it('renders the component using the render prop', async () => {
      const wrapper = mount(
        <UIRouter router={router}>
          <UIView render={(Comp, props) => <Comp {...props} foo={<span>bar</span>} />} />
        </UIRouter>
      );
      await routerGo('withrenderprop');
      expect(wrapper.update().html()).toEqual(`<div><span>withrenderprop</span><span>bar</span></div>`);
    });

    it('unmounts the State Component when calling stateService.reload(true)', async () => {
      const componentDidMountSpy = jest.fn();
      const componentWillUnmountSpy = jest.fn();
      class TestUnmountComponent extends React.Component {
        componentDidMount = componentDidMountSpy;
        componentWillUnmount = componentWillUnmountSpy;
        render() {
          return <div />;
        }
      }
      const testState = {
        name: 'testunmount',
        component: TestUnmountComponent,
      } as ReactStateDeclaration;
      router.stateRegistry.register(testState);

      await routerGo('testunmount');
      const wrapper = mountInRouter(<UIView />);
      expect(componentDidMountSpy).toHaveBeenCalledTimes(1);

      await router.stateService.reload('testunmount');
      expect(componentWillUnmountSpy).toHaveBeenCalledTimes(1);
      expect(componentDidMountSpy).toHaveBeenCalledTimes(2);
      wrapper.unmount();
    });
  });
});
